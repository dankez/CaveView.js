import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const g = new THREE.BufferGeometry();
// some vertices
g.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 0,0,0], 3));
const g2 = mergeVertices(g);
console.log('Merged size:', g2.attributes.position.count);
