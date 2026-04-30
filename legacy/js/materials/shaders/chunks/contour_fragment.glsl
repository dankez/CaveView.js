
float zLine = vPositionZ / contourInterval;

float f = fract( zLine );
float f10 = fract( zLine / 10.0 );
float f100 = fract( zLine / 100.0 );

float df = fwidth( zLine );

if ( f > 0.5 ) f = 1.0 - f;
if ( f10 > 0.5 ) f10 = 1.0 - f10;
if ( f100 > 0.5 ) f100 = 1.0 - f100;

float contourColorSelection = step( 0.91, f10 );

// Base contour width
float c = smoothstep( df * 0.5, df * 1.0, f );

// Thicker lines for major intervals
float c10 = smoothstep( df * 1.0, df * 2.0, f10 );
float c100 = smoothstep( df * 2.0, df * 4.0, f100 );

// Combine them - major lines override base lines
float finalC = min( c, min( c10, c100 ) );

vec4 finalColor = vec4( mix( contourColor, contourColor10, contourColorSelection ), 1.0 );
vec4 baseColorAlpha = vec4( baseColor, opacity );

diffuseColor = mix( finalColor, baseColorAlpha, finalC );