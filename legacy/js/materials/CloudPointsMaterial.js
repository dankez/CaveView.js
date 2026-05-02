import { Color, PointsMaterial, Vector3, ShaderMaterial } from '../Three';
import { SHADING_HEIGHT } from '../core/constants';

class CloudPointsMaterial extends PointsMaterial {

	constructor ( ctx ) {

		super();

		const survey = ctx.survey;
		const limits = survey.modelLimits;
		const zMin = limits.min.z;
		const zMax = limits.max.z;
		const gradient = ctx.cfg.value( 'saturatedGradient', false ) ? 'gradientHi' : 'gradientLow';
		const textureCache = ctx.materials.textureCache;

		this.color = new Color( 0xffffff );
		this.opacity = 1.0;
		this.alphaTest = 0.8;
		this.size = 0.1;
		this.vertexColors = true;

		this.shadingMode = 0; // Default: RGB/Normal lighting

		this.onBeforeCompile = ( shader ) => {

			Object.assign( shader.uniforms, {
				uLight: { value: new Vector3( -1, -1, 2 ).normalize() },
				minZ:   { value: zMin },
				scaleZ: { value: 1 / ( zMax - zMin ) },
				cmap:   { value: textureCache.getTexture( gradient ) },
				shadingMode: { value: this.shadingMode }
			} );

			this.shader = shader; // Store reference to update uniforms later

			const vertexShader = shader.vertexShader
				.replace( '#include <common>', '\nuniform vec3 uLight;\nuniform float minZ;\nuniform float scaleZ;\nvarying float pLight;\nvarying float zMap;\n\n\n$&' )
				.replace( '\tgl_PointSize = size;', 'pLight = saturate( 0.3 + abs( dot( uLight, normalize( normalMatrix * normal ) ) ) );\nzMap = ( position.z - minZ ) * scaleZ;\n\t$&' );

			const fragmentShader = shader.fragmentShader
				.replace( '#include <common>', '\nuniform sampler2D cmap;\nuniform int shadingMode;\nvarying float pLight;\nvarying float zMap;\n\n\n$&' )
				.replace( 'outgoingLight = diffuseColor.rgb;', 
					'if ( shadingMode == 1 ) {\n' +
					'	diffuseColor.rgb = texture2D( cmap, vec2( 1.0 - zMap, 1.0 ) ).rgb;\n' +
					'} else {\n' +
					'	diffuseColor.rgb *= pLight;\n' +
					'}\n$&' );

			shader.vertexShader = vertexShader;
			shader.fragmentShader = fragmentShader;

		};

		return this;

	}

	setShading ( mode ) {

		this.shadingMode = ( mode === SHADING_HEIGHT ) ? 1 : 0;

		if ( this.shader ) {

			this.shader.uniforms.shadingMode.value = this.shadingMode;

		}

	}

}

export { CloudPointsMaterial };