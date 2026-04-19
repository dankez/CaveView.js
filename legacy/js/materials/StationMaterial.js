import { ShaderMaterial, Color, cloneUniforms, mergeUniforms, UniformsLib } from '../Three';

const vertexShader = `
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>

attribute float surveyId;
varying float vSurveyId;

void main() {
	#include <color_vertex>
	
	vSurveyId = surveyId;
	
	vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4( position, 1.0 );
	gl_Position = projectionMatrix * mvPosition;
	
	#include <fog_vertex>
}
`;

const fragmentShader = `
uniform vec3 diffuse;
uniform float opacity;

#include <common>
#include <color_pars_fragment>
#include <fog_pars_fragment>

#ifdef CV_SURVEY
	uniform sampler2D surveyColors;
	uniform float surveyCount;
	varying float vSurveyId;
#endif

void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );

	#ifdef CV_SURVEY
		diffuseColor *= texture2D( surveyColors, vec2( ( vSurveyId + 0.5 ) / surveyCount, 0.5 ) );
	#else
		#include <color_fragment>
	#endif

	gl_FragColor = diffuseColor;

	#include <fog_fragment>
}
`;

class StationMaterial extends ShaderMaterial {
	constructor( ctx, options = {} ) {
		const surveyColourMapper = ctx.surveyColourMapper;
		
		const defines = {};
		const uniforms = mergeUniforms( [
			UniformsLib.common,
			UniformsLib.fog,
			{
				diffuse: { value: new Color( 0xffffff ) },
				opacity: { value: 1.0 }
			}
		] );

		if ( options.survey ) {
			defines.CV_SURVEY = true;
			uniforms.surveyColors = { value: surveyColourMapper.getTexture() };
			uniforms.surveyCount = { value: surveyColourMapper.getTexture().image.width };
		}

		super( {
			vertexShader,
			fragmentShader,
			uniforms,
			defines,
			transparent: true,
			alphaTest: 0.5
		} );
	}
}

export { StationMaterial };
