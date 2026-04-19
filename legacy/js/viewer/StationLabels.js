import { Group, Vector3 } from '../Three';
import { CAMERA_OFFSET, LABEL_STATION, LABEL_STATION_COMMENT } from '../core/constants';
import { GlyphString } from '../core/GlyphString';

const _tmpVector3 = new Vector3();

class StationLabels extends Group {

	constructor ( ctx, stations, commentCount ) {

		super();

		this.type = 'CV.StationLabels';
		this.stations = stations;
		this.commentCount = commentCount;
		this.ctx = ctx;

		const materials = ctx.materials;

		this.defaultLabelMaterial = materials.getLabelMaterial( 'stations.default' );
		this.splayLabelMaterial = materials.getLabelMaterial( 'stations.default' );
		this.junctionLabelMaterial = materials.getLabelMaterial( 'stations.junctions' );
		this.linkedLabelMaterial = materials.getLabelMaterial( 'stations.linked' );

		this.lastUpdate = 0;
		this.lastCameraPosition = new Vector3();

	}

	update ( camera, target, inverseWorld ) {

		const now = performance.now();
		if ( now - this.lastUpdate < 100 ) return; // 10Hz limit

		const cameraPosition = _tmpVector3.copy( camera.position );

		if ( camera.isOrthographicCamera ) {
			cameraPosition.sub( target ).setLength( CAMERA_OFFSET / camera.zoom ).add( target );
		}

		cameraPosition.applyMatrix4( inverseWorld );

		if ( cameraPosition.distanceToSquared( this.lastCameraPosition ) < 1 ) return; // moved < 1m

		this.lastUpdate = now;
		this.lastCameraPosition.copy( cameraPosition );

		const showName = ( ( camera.layers.mask & 1 << LABEL_STATION ) !== 0 );
		const showComments = ( ( camera.layers.mask & 1 << LABEL_STATION_COMMENT ) !== 0 );

		this._updateFromTree( this.ctx.survey.surveyTree, camera, cameraPosition, showName, showComments );

	}

	_updateFromTree ( node, camera, cameraPosition, showName, showComments ) {

		if ( node.isStation() ) {

			this.updateStationLabel( node, camera, cameraPosition, showName, showComments );
			return;

		}

		// Spatial pruning: if the entire bounding box is too far, hide all labels in this subtree
		if ( node.boundingBox.distanceToPoint( cameraPosition ) > 500 ) {
			
			node.traverse( n => { if ( n.label ) n.label.visible = false; } );
			return;

		}

		const children = node.children;
		for ( let i = 0, l = children.length; i < l; i++ ) {
			this._updateFromTree( children[ i ], camera, cameraPosition, showName, showComments );
		}

	}

	updateStationLabel ( station, camera, cameraPosition, showName, showComments ) {

		const comment = station.comment;
		const label = station.label;
		const showComment = showComments && comment !== undefined;

		if ( ! this.stations.isStationVisible( station ) ) {
			if ( label ) label.visible = false;
			return;
		}

		const connections = station.effectiveConnections();
		let d2 = 40000;

		if ( label?.visible ) {

			if ( connections === 0 ) {
				d2 = 600;
			} else if ( connections < 3 ) {
				d2 = 10000;
			} else {
				d2 = 50000;
			}

		} else {

			if ( connections === 0 ) {
				d2 = 250;
			} else if ( connections < 3 ) {
				d2 = 5000;
			}

		}

		// eager display of comments
		if ( showComment ) d2 *= ( this.stations.vertices.length / this.commentCount );

		// show labels for network vertices at greater distance than intermediate stations
		const visible = ( station.distanceToSquared( cameraPosition ) < d2 );

		if ( visible ) {

			let name = '';

			if ( showName ) name += station.name;
			if ( showName && showComment ) name += ' ';
			if ( showComment ) name += comment;

			if ( label && label.name !== name ) {
				this.remove( label );
				station.label = null;
			}

			if ( ! station.label ) {
				this.addLabel( station, name, connections );
			}

			if ( station.label ) station.label.visible = true;

		} else {

			if ( label ) label.visible = false;

		}

	}

	addLabel ( station, name, connections ) {

		let material;

		if ( station.next !== null ) {

			let next = station.next;

			// skip labels for all expect lowest id station
			while ( next !== station ) {

				if ( Math.abs( station.id ) > Math.abs( next.id ) ) return;
				next = next.next;

			}

			material = this.linkedLabelMaterial;

		} else if ( connections === 0 ) {

			material = this.splayLabelMaterial;

		} else if ( connections < 3 ) {

			material = this.defaultLabelMaterial;

		} else {

			material = this.junctionLabelMaterial;

		}

		const label = new GlyphString( name, material, this.ctx );

		label.layers.mask = this.layers.mask;
		label.position.copy( station );

		station.label = label;

		this.addStatic( label );

	}

}

export { StationLabels };