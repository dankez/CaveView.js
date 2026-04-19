import { DataTexture, RGBAFormat, UnsignedByteType } from '../Three';

function SurveyColourMapper ( ctx ) {

	let map = [];
	let selectedSection = 0;
	let texture = null;

	this.getColour = function ( surveyId ) {

		const surveyColours = ctx.materials.colourCache.getColorSet( 'survey' );

		return surveyColours[ surveyId % surveyColours.length ];

	};

	this.getTexture = function () {

		if ( texture && map.length > 0 ) return texture;

		// find max survey id
		let maxId = 0;
		for ( let id in map ) {
			maxId = Math.max( maxId, parseInt( id ) );
		}

		const size = maxId + 1;
		const data = new Uint8Array( size * 4 );

		for ( let i = 0; i < size; i++ ) {

			const color = map[ i ] || { r: 1, g: 1, b: 1 };
			data[ i * 4 ]     = Math.floor( color.r * 255 );
			data[ i * 4 + 1 ] = Math.floor( color.g * 255 );
			data[ i * 4 + 2 ] = Math.floor( color.b * 255 );
			data[ i * 4 + 3 ] = 255;

		}

		texture = new DataTexture( data, size, 1, RGBAFormat, UnsignedByteType );
		texture.needsUpdate = true;

		return texture;

	};

	this.getColourMap = function ( newSelectedSection ) {
// ...

		if ( selectedSection === newSelectedSection && map.length > 0 ) {

			// use cached mapping
			return map;

		}

		map = [];
		texture = null;
		selectedSection = newSelectedSection;

		// create mapping of survey id to colour
		// map each child id _and_ all its lower level survey ids to the same colour

		let subTree = selectedSection;
		let colour = this.getColour( selectedSection.id );

		_addMapping( subTree );

		let children = subTree.children;

		while ( children.length === 1 ) {

			subTree = children[ 0 ];
			_addMapping( subTree );
			children = subTree.children;

		}

		for ( let i = 0, l = children.length; i < l; i++ ) {

			const node = children[ i ];

			colour = this.getColour( node.id );

			node.traverse( _addMapping );

		}

		return map;

		function _addMapping ( node ) {

			// only add values for sections - not stations
			if ( ! node.isStation() ) map[ node.id ] = colour;

		}

	};

}

export { SurveyColourMapper };