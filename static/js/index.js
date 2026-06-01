window.HELP_IMPROVE_VIDEOJS = false;

function initDiffusionSphere() {
	var canvas = document.getElementById('diffusion-sphere-canvas');
	if (!canvas) {
		return;
	}

	var ctx = canvas.getContext('2d');
	if (!ctx) {
		return;
	}

	var dpr = window.devicePixelRatio || 1;
	var width = 0;
	var height = 0;
	var sphereRadius = 0;
	var center = { x: 0, y: 0 };
	var basePoints = [];
	var x0 = normalize({ x: 0.7, y: -0.18, z: 0.68 });
	var tSlider = document.getElementById('diffusion-t-slider');
	var tValueLabel = document.getElementById('diffusion-t-value');
	var diffusionT = 0.35;

	function randomSpherePoint() {
		var u = Math.random() * 2 - 1;
		var phi = Math.random() * Math.PI * 2;
		var s = Math.sqrt(1 - u * u);
		return {
			x: s * Math.cos(phi),
			y: u,
			z: s * Math.sin(phi)
		};
	}

	function randomGaussian() {
		var u1 = Math.max(Math.random(), 1e-8);
		var u2 = Math.random();
		return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
	}

	function normalize(v) {
		var n = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
		return { x: v.x / n, y: v.y / n, z: v.z / n };
	}

	function rotateY(v, a) {
		var c = Math.cos(a);
		var s = Math.sin(a);
		return {
			x: c * v.x + s * v.z,
			y: v.y,
			z: -s * v.x + c * v.z
		};
	}

	function rotateX(v, a) {
		var c = Math.cos(a);
		var s = Math.sin(a);
		return {
			x: v.x,
			y: c * v.y - s * v.z,
			z: s * v.y + c * v.z
		};
	}

	function project(v) {
		var z = v.z + 2.35;
		var f = 1 / z;
		return {
			x: center.x + v.x * sphereRadius * 1.55 * f,
			y: center.y + v.y * sphereRadius * 1.55 * f,
			depth: z
		};
	}

	function setupPoints() {
		basePoints = [];
		for (var i = 0; i < 340; i++) {
			basePoints.push(randomSpherePoint());
		}
	}

	function resize() {
		var rect = canvas.getBoundingClientRect();
		width = Math.max(1, Math.floor(rect.width));
		height = Math.max(1, Math.floor(rect.height));
		dpr = window.devicePixelRatio || 1;
		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		center.x = width * 0.5;
		center.y = height * 0.54;
		sphereRadius = Math.min(width, height) * 0.35;
		setupPoints();
	}

	function alphaBar(t) {
		// Cosine-shaped VP schedule: high signal at small t, high noise at large t.
		var s = 0.008;
		var c0 = Math.cos((s / (1 + s)) * Math.PI * 0.5);
		var ct = Math.cos(((t + s) / (1 + s)) * Math.PI * 0.5);
		return Math.max(0.0001, (ct * ct) / (c0 * c0));
	}

	function drawFrame(ts) {
		var timeSec = ts * 0.001;
		var yaw = timeSec * 0.42;
		var pitch = Math.sin(timeSec * 0.53) * 0.18;
		var t = diffusionT;
		var abar = alphaBar(t);
		var sig = Math.sqrt(1 - abar);
		var sigData = Math.sqrt(abar);

		var g = ctx.createLinearGradient(0, 0, 0, height);
		g.addColorStop(0, 'rgba(8, 25, 42, 0.95)');
		g.addColorStop(1, 'rgba(7, 50, 57, 0.94)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, width, height);

		var sphere2d = [];
		for (var i = 0; i < basePoints.length; i++) {
			var rv = rotateX(rotateY(basePoints[i], yaw), pitch);
			var p = project(rv);
			sphere2d.push({ x: p.x, y: p.y, z: rv.z });
		}

		sphere2d.sort(function(a, b) { return a.z - b.z; });
		for (var j = 0; j < sphere2d.length; j++) {
			var pt = sphere2d[j];
			var a = 0.2 + 0.5 * (pt.z + 1) * 0.5;
			ctx.fillStyle = 'rgba(160, 212, 255, ' + a.toFixed(3) + ')';
			ctx.beginPath();
			ctx.arc(pt.x, pt.y, 1.6, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.strokeStyle = 'rgba(170, 225, 255, 0.22)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.ellipse(center.x, center.y, sphereRadius * 0.78, sphereRadius * 0.78, 0, 0, Math.PI * 2);
		ctx.stroke();

		var x0Rot = rotateX(rotateY(x0, yaw), pitch);
		var x0p = project(x0Rot);

		for (var k = 0; k < 110; k++) {
			var eps = { x: randomGaussian(), y: randomGaussian(), z: randomGaussian() };
			var xt = {
				x: sigData * x0.x + sig * eps.x,
				y: sigData * x0.y + sig * eps.y,
				z: sigData * x0.z + sig * eps.z
			};
			var xtRot = rotateX(rotateY(xt, yaw), pitch);
			var xtp = project(xtRot);
			var r = 0.7 + 2.2 * (1 - abar);
			var alpha = 0.18 + 0.38 * (1 - abar);
			ctx.fillStyle = 'rgba(77, 238, 255, ' + alpha.toFixed(3) + ')';
			ctx.beginPath();
			ctx.arc(xtp.x, xtp.y, r, 0, Math.PI * 2);
			ctx.fill();
		}

		var halo = 8 + 6 * (1 - abar);
		var haloGrad = ctx.createRadialGradient(x0p.x, x0p.y, 0, x0p.x, x0p.y, halo);
		haloGrad.addColorStop(0, 'rgba(255, 228, 120, 0.9)');
		haloGrad.addColorStop(1, 'rgba(255, 228, 120, 0)');
		ctx.fillStyle = haloGrad;
		ctx.beginPath();
		ctx.arc(x0p.x, x0p.y, halo, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = 'rgba(255, 228, 120, 1)';
		ctx.beginPath();
		ctx.arc(x0p.x, x0p.y, 3.2, 0, Math.PI * 2);
		ctx.fill();

		ctx.font = '600 14px "Noto Sans", sans-serif';
		ctx.fillStyle = 'rgba(230, 246, 255, 0.9)';
		ctx.fillText('VP diffusion time t = ' + t.toFixed(2), 20, 30);

		requestAnimationFrame(drawFrame);
	}

	function updateDiffusionTFromSlider() {
		if (!tSlider) {
			return;
		}
		diffusionT = Math.max(0, Math.min(1, parseFloat(tSlider.value) || 0));
		if (tValueLabel) {
			tValueLabel.textContent = diffusionT.toFixed(2);
		}
		tSlider.setAttribute('aria-valuenow', diffusionT.toFixed(2));
	}

	resize();
	if (tSlider) {
		tSlider.addEventListener('input', updateDiffusionTFromSlider);
		updateDiffusionTFromSlider();
	}
	window.addEventListener('resize', resize);
	requestAnimationFrame(drawFrame);
}


document.addEventListener('DOMContentLoaded', function() {
    // Check for click events on the navbar burger icon

    var options = {
			slidesToScroll: 1,
			slidesToShow: 1,
			loop: true,
			infinite: true,
			autoplay: true,
			autoplaySpeed: 5000,
    }

		// Initialize all div with carousel class
    var carousels = bulmaCarousel.attach('.carousel', options);
	
    bulmaSlider.attach();
		// initDiffusionSphere();

});
