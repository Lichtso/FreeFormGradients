import DistanceTransform from './DistanceTransform.js';
import Diffusion from './Diffusion.js';

const gl = document.querySelector('canvas').getContext('webgl2'),
      button = document.querySelector('input');

button.onchange = function(event) {
    const files = (event.target || window.event.srcElement).files;
    if(files.length == 0)
        return;
    const fileReader = new FileReader();
    fileReader.onload = function() {
        const image = new Image();
        image.src = fileReader.result;
        image.onload = render.bind(undefined, image);
    }
    fileReader.readAsDataURL(files[0]);
}

function render(image) {
    const imageTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    gl.canvas.width = image.width;
    gl.canvas.height = image.height;
    gl.canvas.style = `width: ${Math.floor(gl.canvas.width/window.devicePixelRatio)}px;`;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const distanceTransform = new DistanceTransform(gl);
    const positionMap = distanceTransform.render(gl, imageTexture);

    const diffusion = new Diffusion(gl);
    const diffusedImageTexture = diffusion.render(gl, imageTexture, positionMap, 8);

    const canvas = document.createElement('canvas'),
          ctx = canvas.getContext('2d');
    canvas.width = gl.canvas.width;
    canvas.height = gl.canvas.height;
    ctx.drawImage(gl.canvas, 0, 0);
    button.type = 'button';
    button.value = 'Download';
    button.onclick = function(event) {
        location.href = canvas.toDataURL('image/png');
    };
}
