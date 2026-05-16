#include <clipping_planes_pars_vertex>

attribute vec3 color;
attribute float intensity;

varying vec3 vColor;
varying float vIntensity;

uniform float pointSize;

void main() {
    vColor = color;
    vIntensity = intensity;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Size attenuation
    gl_PointSize = pointSize * (1000.0 / -mvPosition.z);

    vViewPosition = - mvPosition.xyz;
    #include <clipping_planes_vertex>
}
