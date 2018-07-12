export function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    shader.uniformBindings = new Map();
    while(true) {
        const match = /layout\(binding\s*=\s*([0-9]+)\)\s*uniform\s*([^;]*)\s(.*);/g.exec(source);
        if(!match)
            break;
        source = source.replace(match[0], 'uniform '+match[2]+' '+match[3]+';');
        shader.uniformBindings.set(match[3], match[1]);
    }
    gl.shaderSource(shader, `#version 300 es
precision mediump float;
precision mediump usampler2D;
`+source);
    gl.compileShader(shader);
    if(gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        return shader;
    console.warn(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
};

export function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if(gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.useProgram(program);
        for(const [name, binding] of fragmentShader.uniformBindings)
            gl.uniform1i(gl.getUniformLocation(program, name), binding);
        return program;
    }
    console.warn(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
};

let identityVertexShader;
export function getIdentityVertexShader(gl) {
    if(!identityVertexShader)
        identityVertexShader = createShader(gl, gl.VERTEX_SHADER, `
in vec4 position;

void main() {
    gl_Position = position;
}`      );
    return identityVertexShader;
};

let quadPositionBuffer;
export function renderQuad(gl) {
    if(!quadPositionBuffer) {
        quadPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quadPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    } else
        gl.bindBuffer(gl.ARRAY_BUFFER, quadPositionBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
}
