import {
	BufferGeometry, Float32BufferAttribute, InstancedMesh, InterleavedBuffer, InterleavedBufferAttribute,
	Matrix4, CircleGeometry, MeshBasicMaterial, Vector3, Vector4, Color, InstancedBufferAttribute
} from '../Three';

import { STATION_ENTRANCE } from '../core/constants';
import { PointIndicator } from './PointIndicator';

const _position = new Vector4();
const _ssOrigin = new Vector4();
const _mouse = new Vector3();
const _mvMatrix = new Matrix4();

class Stations extends InstancedMesh {

	constructor ( survey ) {

		const ctx = survey.ctx;

		super( new BufferGeometry(), ctx.materials.getExtendedPointsMaterial(), 1 );

		this.type = 'CV.Stations';
		this.stationCount = 0;
		this.ctx = ctx;

		const cfg = ctx.cfg;

		this.baseColor     = cfg.themeColor( 'stations.default.marker' );
		this.junctionColor = cfg.themeColor( 'stations.junctions.marker' );
		this.entranceColor = cfg.themeColor( 'stations.entrances.marker' );

		this.vertices = [];
		this.pointSizes = [];
		this.instanceData = []; // will be used for positions and colors until finalise

		this.survey = survey;
		this.selected = null;
		this.selectedSize = 0;
		this.selection = survey.selection;
		this.splaysVisible = false;
		this.ssThresholdSq = Math.pow( cfg.value( 'stationSelectionDistance', 12 ), 2 );

		const point = new PointIndicator( ctx, 0xff0000 );

		point.visible = false;

		this.addStatic( point );
		this.highlightPoint = point;
	}

	raycast( raycaster, intersects ) {

		// screen space raycasing for stations

		if ( ! this.visible ) return intersects;

		const matrixWorld = this.matrixWorld;
		const ray = raycaster.ray;

		// test against survey section bounding boxes

		const surveyTree = this.survey.surveyTree;
		const searchNodes = surveyTree.findIntersects( matrixWorld, ray );

		const camera = raycaster.camera;
		const projectionMatrix = camera.projectionMatrix;
		const skipSplays = ! this.splaysVisible;
		const near = - camera.near;

		ray.at( 1, _ssOrigin );

		// ndc space [ - 1.0, 1.0 ]
		const container = this.ctx.container;

		const scale = new Vector3( container.clientWidth / 2, container.clientHeight / 2, 1 );

		_ssOrigin.w = 1;

		_ssOrigin.applyMatrix4( camera.matrixWorldInverse );
		_ssOrigin.applyMatrix4( camera.projectionMatrix );
		_ssOrigin.multiplyScalar( 1 / _ssOrigin.w );

		// screen space
		_mouse.copy( _ssOrigin );
		_mouse.multiply( scale );

		_mvMatrix.multiplyMatrices( camera.matrixWorldInverse, matrixWorld );

		const ssThresholdSq = this.ssThresholdSq;

		for ( const node of searchNodes ) {

			const vertices = node.children;

			for ( let i = 0, l = vertices.length; i < l; i ++ ) {

				const station = vertices[ i ];

				// skip splay end stations if not visible
				if ( skipSplays && station.connections === 0 && station.type === 1 ) continue;

				_position.copy( station );
				_position.w = 1;

				_position.applyMatrix4( _mvMatrix );

				if ( _position.z > near ) {

					continue;

				}

				_position.applyMatrix4( projectionMatrix );
				_position.multiplyScalar( 1 / _position.w );

				_position.x *= scale.x;
				_position.y *= scale.y;

				testPoint( _position, station, i, ssThresholdSq, intersects, this );

			}

		}

	}

	count () {

		return this.vertices.length;

	}

	addStation ( node ) {

		if ( node.stationVertexIndex != -1 ) return; // duplicated entry

		const instanceData = this.instanceData;
		const offset = instanceData.length;

		let pointSize = 0.0;
		let color;

		if ( node.type & STATION_ENTRANCE ) {

			color = this.entranceColor;
			pointSize = 12.0;

		} else {

			color = node.effectiveConnections() > 2 ? this.junctionColor : this.baseColor;
			pointSize = 8.0;

		}

		this.vertices.push( node );

		node.toArray( instanceData, offset );
		color.toArray( instanceData, offset + 3 );
		instanceData.push( node.parent.id ); // [offset + 6]

		this.pointSizes.push( pointSize );

		node.stationVertexIndex = this.stationCount++;

	}

	isStationVisible ( node ) {

		return ( this.selection.contains( node.parent.id ) &&
			( node.connections > 0 || this.splaysVisible )
		);

	}

	getStationByIndex ( index ) {

		return this.vertices[ index ];

	}

	clearSelected () {

		if ( this.selected !== null ) {

			const matrix = new Matrix4();
			const position = new Vector3();

			this.getMatrixAt( this.selected, matrix );
			position.setFromMatrixPosition( matrix );

			const scale = this.selectedSize * 0.1;
			matrix.makeTranslation( position.x, position.y, position.z );
			matrix.scale( new Vector3( scale, scale, scale ) );

			this.setMatrixAt( this.selected, matrix );
			this.instanceMatrix.needsUpdate = true;

			this.selected = null;

		}

	}

	highlightStation ( node ) {

		const highlightPoint = this.highlightPoint;

		highlightPoint.position.copy( node );
		highlightPoint.updateMatrix();

		highlightPoint.visible = true;

		return node;

	}

	clearHighlight () {

		this.highlightPoint.visible = false;

	}

	selectStation ( node ) {

		this.selectStationByIndex( node.stationVertexIndex );

	}

	selectStationByIndex ( index ) {

		const matrix = new Matrix4();
		const position = new Vector3();

		if ( this.selected !== null ) {

			this.getMatrixAt( this.selected, matrix );
			position.setFromMatrixPosition( matrix );

			const oldScale = this.selectedSize * 0.1;
			matrix.makeTranslation( position.x, position.y, position.z );
			matrix.scale( new Vector3( oldScale, oldScale, oldScale ) );

			this.setMatrixAt( this.selected, matrix );

		}

		this.getMatrixAt( index, matrix );
		position.setFromMatrixPosition( matrix );
		
		// Extract current size (scale) to restore it later
		this.selectedSize = matrix.elements[ 0 ] * 10.0; // approximation

		const newScale = this.selectedSize * 0.2; // double the size for selection
		matrix.makeTranslation( position.x, position.y, position.z );
		matrix.scale( new Vector3( newScale, newScale, newScale ) );

		this.setMatrixAt( index, matrix );
		this.instanceMatrix.needsUpdate = true;

		this.selected = index;

	}

	setShading ( mode ) {

		const materials = this.ctx.materials;

		if ( mode === 'survey' ) {

			this.material = materials.getStationMaterial( { survey: true } );

		} else {

			this.material = materials.getStationMaterial();

		}

	}

	selectStations ( selection ) {

		const vertices = this.vertices;
		const l = vertices.length;
		const splaySize = this.splaysVisible ? 6.0 : 0.0;
		const idSet = selection.getIds();
		const isEmpty = selection.isEmpty();

		const matrix = new Matrix4();
		const position = new Vector3();

		for ( let i = 0; i < l; i++ ) {

			const node = vertices[ i ];
			let size = 8;

			if ( isEmpty || idSet.has( node.parent.id ) ) {

				if ( node.type & STATION_ENTRANCE ) {

					size = 12;

				} else if ( node.connections === 0 ) {

					size = splaySize;

				}

			} else {

				size = 0;
				if ( node.label !== undefined ) node.label.visible = false;

			}

			// Update instance matrix scale
			this.getMatrixAt( i, matrix );
			position.setFromMatrixPosition( matrix );
			
			const scale = size * 0.1;
			matrix.makeTranslation( position.x, position.y, position.z );
			matrix.scale( new Vector3( scale, scale, scale ) );
			
			this.setMatrixAt( i, matrix );

		}

		this.instanceMatrix.needsUpdate = true;

	}

	finalise () {

		const count = this.stationCount;
		const instanceData = this.instanceData;
		const pointSizes = this.pointSizes;

		// Re-initialize InstancedMesh properties
		this.geometry = new CircleGeometry( 0.5, 8 );
		
		// Use custom StationMaterial for instances
		this.material = ctx.materials.getStationMaterial();

		this.count = count;
		this.instanceMatrix.setUsage( 35048 ); // StaticDrawUsage
		this.instanceMatrix.array = new Float32Array( count * 16 );
		
		const colors = new Float32Array( count * 3 );
		this.instanceColor = new Float32BufferAttribute( colors, 3 );
		
		const surveyIds = new Float32Array( count );
		const surveyIdAttribute = new InstancedBufferAttribute( surveyIds, 1 );
		this.geometry.setAttribute( 'surveyId', surveyIdAttribute );

		const matrix = new Matrix4();
		const position = new Vector3();
		const color = new Color();

		for ( let i = 0; i < count; i++ ) {

			const offset = i * 7;
			position.set( instanceData[ offset ], instanceData[ offset + 1 ], instanceData[ offset + 2 ] );
			color.setRGB( instanceData[ offset + 3 ], instanceData[ offset + 4 ], instanceData[ offset + 5 ] );
			surveyIds[ i ] = instanceData[ offset + 6 ];

			const size = pointSizes[ i ] * 0.1; // scale down for 3D space
			matrix.makeTranslation( position.x, position.y, position.z );
			matrix.scale( new Vector3( size, size, size ) );

			this.setMatrixAt( i, matrix );
			this.setColorAt( i, color );

		}

		this.instanceMatrix.needsUpdate = true;
		if ( this.instanceColor ) this.instanceColor.needsUpdate = true;

		this.instanceData = null;

	}

	setSplaysVisibility ( visible ) {

		this.splaysVisible = visible;
		const splaySize = visible ? 6.0 : 0.0;

		const vertices = this.vertices;
		const l = vertices.length;
		const selection = this.selection;

		const matrix = new Matrix4();
		const position = new Vector3();

		for ( let i = 0; i < l; i++ ) {

			const node = vertices[ i ];

			if ( node.connections === 0 && ( splaySize === 0 || selection.contains( node.id ) ) ) {

				this.getMatrixAt( i, matrix );
				position.setFromMatrixPosition( matrix );

				const scale = splaySize * 0.1;
				matrix.makeTranslation( position.x, position.y, position.z );
				matrix.scale( new Vector3( scale, scale, scale ) );

				this.setMatrixAt( i, matrix );

			}

		}

		this.instanceMatrix.needsUpdate = true;
	}

	resetPaths () {

		this.vertices.forEach( node => node.shortestPath = Infinity );

	}

	forEach ( callback ) {

		this.vertices.forEach( station => {

			if ( station.connections !== 0 ) callback( station );

		} );

	}

}

function testPoint( point, station, index, localThresholdSq, intersects, object ) {

	const dX = point.x - _mouse.x;
	const dY = point.y - _mouse.y;

	const distanceSq = dX * dX + dY * dY;

	if ( distanceSq < localThresholdSq ) {

		intersects.push( {
			distance: Math.sqrt( distanceSq ),
			point: point,
			index: index,
			station: station,
			face: null,
			object: object
		} );

	}

}

export { Stations };