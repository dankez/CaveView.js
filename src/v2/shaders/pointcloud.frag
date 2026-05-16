#include <clipping_planes_pars_fragment>

varying vec3 vColor;
varying float vIntensity;

void main() {
    #include <clipping_planes_fragment>

    vec2 pc = gl_PointCoord - 0.5;
    if (dot(pc, pc) > 0.25) discard; // Circular points

    gl_FragColor = vec4(vColor * vIntensity, 1.0);
}
