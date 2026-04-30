import { CommonTerrainMaterial } from './CommonTerrainMaterial';

class ContourMaterial extends CommonTerrainMaterial {

	constructor ( ctx ) {

		const survey = ctx.survey;
		const cfg = ctx.cfg;
		const materials = ctx.materials;

		super( ctx );

		this.extensions = { derivatives: true };

		const self = this;

		this.onBeforeCompile = function ( shader ) {

			this.commonBeforeCompile( ctx, shader );

			const uniforms = shader.uniforms;

			Object.assign( uniforms, {
				zOffset:         { value: survey.offsets.z },
				contourInterval: materials.uniforms.commonTerrain.contourInterval,
				contourColor:    { value: cfg.themeColor( 'shading.contours.line' ) },
				contourColor10:  { value: cfg.themeColor( 'shading.contours.line10' ) },
				baseColor:       { value: cfg.themeColor( 'shading.contours.base' ) }
			}, materials.uniforms.commonDepth );

			this.editShaderInclude( shader, 'contour' );

			cfg.addEventListener( 'colors', _updateColors );

			this._dispose = function () {
				cfg.removeEventListener( 'colors', _updateColors );
			};

			function _updateColors() {
				uniforms.contourColor.value.copy( cfg.themeColor( 'shading.contours.line' ) );
				uniforms.contourColor10.value.copy( cfg.themeColor( 'shading.contours.line10' ) );
				uniforms.baseColor.value.copy( cfg.themeColor( 'shading.contours.base' ) );
			}

		};

	}

}

export { ContourMaterial };