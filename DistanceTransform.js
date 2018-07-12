import {createShader, createProgram, getIdentityVertexShader, renderQuad} from './Utils.js';

const sweepOffsets = [
    [-1, -1, -1, 0, -1, 1],
    [1, -1, 1, 0, 1, 1],
    [-1, -1, 0, -1, 1, -1],
    [-1, 1, 0, 1, 1, 1]
];

export default class DistanceTransform {
    constructor(gl) {
        this.inputToPositionProgram = createProgram(gl, getIdentityVertexShader(gl),
            createShader(gl, gl.FRAGMENT_SHADER, `
layout(binding=0) uniform sampler2D imageTexture;

out uvec2 position;

void main() {
    float mask = texelFetch(imageTexture, ivec2(gl_FragCoord.xy), 0).a;
    position = (mask > 0.0) ? uvec2(gl_FragCoord.xy) : uvec2(-1, -1);
}`      ));
        this.sweepProgram = createProgram(gl,
            createShader(gl, gl.VERTEX_SHADER, `
uniform vec2 translation;
in vec2 position;

void main() {
    gl_Position.xy = position+translation;
    gl_Position.w = 1.0;
}`          ), createShader(gl, gl.FRAGMENT_SHADER, `
layout(binding=0) uniform usampler2D positionMap;
uniform ivec2 offset[3];

out uvec2 position;

void main() {
    ivec2 size = textureSize(positionMap, 0).xy;
    position = texelFetch(positionMap, ivec2(gl_FragCoord.xy), 0).xy;
    float distance = length(vec2(position)-gl_FragCoord.xy);
    for(int i = 0; i < 3; ++i) {
        ivec2 address = ivec2(gl_FragCoord.xy)+offset[i];
        if(address.x < 0 || address.y < 0 || address.x >= size.x || address.y >= size.y)
            continue;
        uvec2 neighborPos = texelFetch(positionMap, address, 0).xy;
        vec2 diff = vec2(neighborPos)-gl_FragCoord.xy;
        float neighborDist = length(diff);
        if(neighborDist < distance) {
            distance = neighborDist;
            position = neighborPos;
        }
    }
}`      ));
        this.combineProgram = createProgram(gl, getIdentityVertexShader(gl),
            createShader(gl, gl.FRAGMENT_SHADER, `
layout(binding=0) uniform usampler2D positionMap;
uniform ivec2 offset;

out uvec2 position;

void main() {
    if(int(gl_FragCoord.x)%2 == offset.x || int(gl_FragCoord.y)%2 == offset.y)
        discard;
    position = texelFetch(positionMap, ivec2(gl_FragCoord.xy), 0).xy;
}`      ));
        this.fetchProgram = createProgram(gl, getIdentityVertexShader(gl),
            createShader(gl, gl.FRAGMENT_SHADER, `
layout(binding=0) uniform usampler2D positionMap;
layout(binding=1) uniform sampler2D imageTexture;

out vec4 color;

float rand(vec2 co) {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
    ivec2 address = ivec2(texelFetch(positionMap, ivec2(gl_FragCoord.xy), 0).xy);
    color = texelFetch(imageTexture, address, 0);
}`      ));
        this.horizontalLinePositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.horizontalLinePositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.01, 0.0, 1.01, 0.0]), gl.STATIC_DRAW);
        this.verticalLinePositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.verticalLinePositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0.0, -1.01, 0.0, 1.01]), gl.STATIC_DRAW);
        this.framebuffer = gl.createFramebuffer();
        this.positionTextures = [];
        for(let i = 0; i < 2; ++i) {
            this.positionTextures[i] = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.positionTextures[i]);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
    }

    render(gl, imageTexture) {
        gl.activeTexture(gl.TEXTURE0);
        for(let i = 0; i < 2; ++i) {
            gl.bindTexture(gl.TEXTURE_2D, this.positionTextures[i]);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16UI, gl.canvas.width, gl.canvas.height, 0, gl.RG_INTEGER, gl.UNSIGNED_SHORT, null);
        }
        gl.useProgram(this.inputToPositionProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.positionTextures[0], 0);
        gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        renderQuad(gl);
        for(let j = 0; j < 4; ++j) {
            if(j%2 == 0) {
                gl.bindTexture(gl.TEXTURE_2D, this.positionTextures[1]);
                gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RG16UI, 0, 0, gl.canvas.width, gl.canvas.height, 0);
            }
            const programIndex = Math.floor(j/2);
            gl.useProgram(this.sweepProgram);
            gl.uniform2i(gl.getUniformLocation(this.sweepProgram, 'offset[0]'), sweepOffsets[j][0], sweepOffsets[j][1]);
            gl.uniform2i(gl.getUniformLocation(this.sweepProgram, 'offset[1]'), sweepOffsets[j][2], sweepOffsets[j][3]);
            gl.uniform2i(gl.getUniformLocation(this.sweepProgram, 'offset[2]'), sweepOffsets[j][4], sweepOffsets[j][5]);
            const length = (j < 2) ? gl.canvas.width : gl.canvas.height;
            for(let i = 0; i < length; ++i) {
                const textureIndex = i%2,
                      translation = (j%2 == 0) ? ((i+0.5)/length*2-1) : ((length-i-0.5)/length*2-1);
                gl.uniform2fv(gl.getUniformLocation(this.sweepProgram, 'translation'), (j < 2) ? [translation, 0] : [0, translation]);
                gl.bindTexture(gl.TEXTURE_2D, this.positionTextures[textureIndex]);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.positionTextures[1-textureIndex], 0);
                gl.bindBuffer(gl.ARRAY_BUFFER, (j < 2) ? this.verticalLinePositionBuffer : this.horizontalLinePositionBuffer);
                gl.enableVertexAttribArray(0);
                gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
                gl.drawArrays(gl.LINES, 0, 2);
            }
            gl.useProgram(this.combineProgram);
            gl.uniform2iv(gl.getUniformLocation(this.combineProgram, 'offset'), (j < 2) ? [gl.canvas.width%2, 2] : [2, gl.canvas.height%2]);
            gl.bindTexture(gl.TEXTURE_2D, this.positionTextures[1]);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.positionTextures[0], 0);
            renderQuad(gl);
        }
        gl.useProgram(this.fetchProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, this.positionTextures[0]);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        renderQuad(gl);
        gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, gl.canvas.width, gl.canvas.height, 0);
        return this.positionTextures[0];
    }
};
