import {createShader, createProgram, getIdentityVertexShader, renderQuad} from './Utils.js';

export default class Diffusion {
    constructor(gl) {
        this.program = createProgram(gl, getIdentityVertexShader(gl),
            createShader(gl, gl.FRAGMENT_SHADER, `
uniform float factor;
layout(binding=0) uniform sampler2D imageTexture;
layout(binding=1) uniform usampler2D positionMap;

out vec4 color;

const ivec2 offset[4] = ivec2[](
    ivec2(-1, 0),
    ivec2(1, 0),
    ivec2(0, -1),
    ivec2(0, 1)
);

void main() {
    ivec2 size = textureSize(positionMap, 0).xy;
    vec2 position = vec2(texelFetch(positionMap, ivec2(gl_FragCoord.xy), 0).xy);
    float distance = max(0.0, length(vec2(position)-gl_FragCoord.xy)-0.5)*factor;
    for(int i = 0; i < 4; ++i)
        color += texture(imageTexture, (gl_FragCoord.xy+vec2(offset[i])*distance)/vec2(size.xy));
    color *= 0.25;
}`      ));
        this.framebuffer = gl.createFramebuffer();
        this.swapTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.swapTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    render(gl, imageTexture, positionMap, iterations) {
        gl.useProgram(this.program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, positionMap);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.swapTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        for(let i = 0; i < iterations; ++i) {
            if(i == iterations-1)
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            else
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, (i%2 == 0) ? this.swapTexture : imageTexture, 0);
            gl.bindTexture(gl.TEXTURE_2D, (i%2 == 0) ? imageTexture : this.swapTexture);
            gl.uniform1f(gl.getUniformLocation(this.program, 'factor'), 0.92387*(1-i/iterations));
            renderQuad(gl);
        }
        return this.swapTexture;
    }
};
