

function Visualizer(place, config, callback) {
    
    // Initialize internal arrays.
    this.config = {
		points: [],
		lines: [],
		/* in pixels: */
		pointSize: 4,
		width: 400,
		height: 300,
		showInstructions: false,
		allowKeyboardControls: false,
		mode: 'html',
		allowZoom: true,
		propagateMouseEvents: true,
		scaleFactor: 1
    };
    
    this.context = null;
    
    this.initialize(place, config, callback);
}

Visualizer.prototype.initialize = function(place, config, callback) {
	
	// Copy the configuration to the main object.
    if (typeof(config) !== 'undefined') for (var item in config) this.config[item] = config[item];
	
    var self = this;
    if (typeof(place) !== 'undefined') this.place = place;
    
	if (typeof(this.config['boundingBox']) === 'undefined') this.autoFitBoundingBox();
	
	if (this.config.allowKeyboardControls) $(document).keydown( function(e) { self.keyHandler(e) } )
	
	var isDragging = false;
	var mx, my, mx1, my1;
	var self = this;
	this.place
		.empty()
		.mousemove(function(e) {
			mx1 = e.clientX;
			my1 = e.clientY;
		})
		.mousedown(function(e) {
			mx = e.clientX;
			my = e.clientY;
			if (e.button === 2) {
				self.place.on('mousemove.drag',
					function(e1) {
						if (!self.config.propagateMouseEvents) e.stopPropagation();
						
						isDragging = true;
						
						var dx = (mx - e1.clientX) / self.place.width();
						var dy = (e1.clientY - my) / self.place.height();
						mx = e1.clientX;
						my = e1.clientY;
						
						//console.log(e, e1);
						self.moveBoundingBox(dx, dy, 0);
						self.draw();
					}
				);
			}
		})
		.mouseup(function(e) {
			if (!self.config.propagateMouseEvents) e.stopPropagation();
			
			if (e.button === 2) {
				var wasDragging = isDragging;
				isDragging = false;
				self.place.unbind("mousemove.drag");
				if (wasDragging) {
					var dx = (mx - e.clientX) / self.place.width();
					var dy = (e.clientY - my) / self.place.height();
					self.moveBoundingBox(dx, dy, 0);
					self.draw();
				}
			}
		})
		.on('mousewheel DOMMouseScroll',
			function(e) {
				if (self.config.allowZoom) {
					e.preventDefault();
					if (!self.config.propagateMouseEvents) e.stopPropagation();
					var delta = typeof(e.originalEvent.wheelDelta) === 'undefined' ? e.originalEvent.detail / 3 : -e.originalEvent.wheelDelta / 120;
					
					var cx = self.place.width() / 2;
					var cy = self.place.height() / 2;
					
					var dx = (cx - mx1) / self.place.width();
					var dy = (my1 - cy) / self.place.height();
					
					//var dz = (Math.pow(5 / 4, delta) - 1) / 2;
					var dz = Math.pow(9 / 8, delta) - 1;
					
					self.moveBoundingBox(-dx, -dy, dz);
					self.moveBoundingBox(dx, dy, 0);
					self.draw();
				}
			}
		)
		.addClass('visualizer')
	if (this.config.mode === 'canvas') {
		this.place.append('<canvas width="' + this.config.width + '" height="' + this.config.height + '">this is my canvas</canvas>');
		this.context = this.place.find('canvas')[0].getContext('2d');
	}
	else if (this.config.mode === 'html') {
		this.place
			.css('width', this.config.width + "px")
			.css('height', this.config.height + "px");
		this.context = null;
		this.updatePoints();
	}
	
	if (this.config.showInstructions === true)
		this.place.after('<p>Alter the view either using keyboard or mouse. Arrow keys, as well as J,I,L and K, move the board left, up, right and down.</br>A and Z zoom in and out respectively.</p>');
	
	if (typeof(callback) === 'function') callback.call(window);
}

Visualizer.prototype.setLines = function(newLines) {
	this.config.lines = newLines;
}

Visualizer.prototype.setPoints = function(newPoints) {
	this.config.points = newPoints;
	this.updatePoints();
}

Visualizer.prototype.updatePoints = function(updateContent) {
	updateContent = typeof(updateContent) === 'boolean' ? updateContent : false;
	
	if (this.config.mode === 'html') {
		//this.place.empty();
		
		for (var item in this.config.points) {
			var p0 = this.config.points[item];
			if (typeof(p0) === 'object') {
				var p = this.fitToBoundingBox(p0);
				
				var scale = typeof(p['z']) === 'number' ? 1 / p.z : 1;
				var scaleStr = this.__scaleStr(scale * this.config.scaleFactor);
				
				var currentP = this.place.find('#' + item + '.point');
				if (currentP.length > 0) {
					if (updateContent) currentP.empty().append(typeof(p['content']) === 'undefined' ? '' : p.content);
					currentP.attr('style', 'position: absolute; left: ' + p.x + 'px; top: ' + p.y + 'px; transform: ' + scaleStr + ';');
				}
				else {
				$('<div id="' + item + '" class="point" style="position: absolute; left: ' + p.x + 'px; top: ' + p.y + 'px; transform: ' + scaleStr + ';"></div>')
						.appendTo(this.place)
						.append(typeof(p['content']) === 'undefined' ? '' : p.content);
				}
			}
		}
	}
}

Visualizer.prototype.addPoints = function(newPoints) {
	if (Array.isArray(newPoints)) for (var item in newPoints) this.config.points.push(newPoints[item]);
	else this.config.points.push(newPoints);
	this.updatePoints();
}

Visualizer.prototype.removePoint = function(id) {
	this.config.points[id] = undefined;
	this.place.find('#' + id).remove();
	this.updatePoints();
}

Visualizer.prototype.addLines = function(newLines) {
	if (Array.isArray(newLines)) for (var item in newLines) this.config.lines.push(newLines[item]);
	else this.config.lines.push(newLines);
}

Visualizer.prototype.moveBoundingBox = function(dx, dy, dz) {
	var bb = this.config.boundingBox;
	var cx = (bb.right - bb.left) / 2 + bb.left;
	var cy = (bb.top - bb.bottom) / 2 + bb.bottom;
	var moveX = (bb.right - bb.left) * dx;
	var moveY = (bb.top - bb.bottom) * dy;
	var zoomX = (1 + dz) * (bb.right - cx);
	var zoomY = (1 + dz) * (bb.top - cy);
	
	this.config.scaleFactor = this.config.scaleFactor / (1 + dz);
	
	bb.left = cx + moveX - zoomX;
	bb.right = cx + moveX + zoomX;
	bb.top = cy + moveY + zoomY;
	bb.bottom = cy + moveY - zoomY;
}

Visualizer.prototype.keyHandler = function(e) {
	//TODO check that focus is not in a textarea or text input before applying key events.
	switch (e.keyCode) {
		case 74: case 37: this.moveBoundingBox(-0.1,    0,    0); break;
		case 73: case 38: this.moveBoundingBox(   0,  0.1,    0); break;
		case 76: case 39: this.moveBoundingBox( 0.1,    0,    0); break;
		case 75: case 40: this.moveBoundingBox(   0, -0.1,    0); break;
		case 90: case 173: this.moveBoundingBox(   0,    0, 0.25); break;
		case 65: case 171: this.moveBoundingBox(   0,    0, -0.2); break;
		default: /*console.log('unused key: ', e.keyCode);*/ break;
	}
	
	this.draw();
}

Visualizer.prototype.setBoundingBox = function(top, left, bottom, right) {
    this.config.boundingBox = {
		top: top,
		left: left,
		bottom: bottom,
		right: right
    }
}

Visualizer.prototype.autoFitBoundingBox = function() {
	// TODO version that keeps aspect ratio.
	
	var top = Number.MIN_VALUE;
	var left = Number.MAX_VALUE;
	var bottom = Number.MAX_VALUE;
	var right = Number.MIN_VALUE;
		
	if (this.config.points.length >= 2) { // At least two points.
	
		for (var item in this.config.points) {
			var p = this.config.points[item];
			if (p.x < left) left = p.x;
			if (p.x > right) right = p.x;
			if (p.y > top) top = p.y;
			if (p.y < bottom) bottom = p.y;
		} 
		
		var maxFrame = Math.max(this.config.width, this.config.height);
		xFrameRatio = this.config.width / maxFrame;
		yFrameRatio = this.config.height / maxFrame;
		
		var maxData = Math.max(right - left, top - bottom);
		xDataRatio = (right - left) / maxData;
		yDataRatio = (top - bottom) / maxData;
		
		var uppX = (right - left) / this.config.width; // units per pixel
		var uppY = (top - bottom) / this.config.height; // units per pixel
		var upp = Math.max(uppX, uppY);
		
		var cx = (right + left) / 2;
		var cy = (top + bottom) / 2;
		var xSize = upp * this.config.width / 2;
		var ySize = upp * this.config.height / 2;
		left = cx - xSize;
		right = cx + xSize;
		top = cy + ySize;
		bottom = cy - ySize;
		
		//console.log(top, left, bottom, right);
		
	} else if (this.config.points.length == 1) { // Only one point.
		top = this.config.points[0].y + 1;
		left = this.config.points[0].x - 1;
		bottom = this.config.points[0].y - 1;
		right = this.config.points[0].x + 1;
	} else { // No content.
		top =  1;
		left = 0;
		bottom = 0;
		right = 1;
	}
	
	this.setBoundingBox(top, left, bottom, right);
	if (this.config.mode === 'canvas') this.moveBoundingBox(0, 0, 0.25); // Zoom out once to keep points from hitting borders.
}

Visualizer.prototype.fitToBoundingBox = function(p) {
    if (typeof(p) !== 'object') return p;
	
    var bb = this.config.boundingBox;
	
	var dx, dy;
	var wid = bb.right - bb.left;
	var hei = bb.bottom - bb.top;
	if (typeof(p.z) === 'number') {
		
		dx = (p.x - bb.left - wid / 2) / (p.z * wid) + 0.5;
		dy = (p.y - bb.top - hei / 2) / (p.z * hei)  + 0.5;
		
	}
	else {
		dx = (p.x - bb.left) / wid;
		dy = (p.y - bb.top) / hei;
	}
    var inside = (dx >= 0) && (dy >= 0) && (dx < 1) && (dy < 1);
	
    var result = {};
	for (var item in p) result[item] = p[item];
	
	result.x = dx * this.config.width;
	result.y = dy * this.config.height;
	result.inside = inside;
	
	return result;
}

Visualizer.prototype.inverseScreenCoordinates = function(x, y, z) {
    var bb = this.config.boundingBox;
	var wid = bb.right - bb.left;
	var hei = bb.bottom - bb.top;
	
	if (typeof(z) === 'number') {
		return {
			x: (x / this.config.width - 0.5) * wid * z + wid / 2 + bb.left,
			y: (y / this.config.height - 0.5) * hei * z + hei / 2 + bb.top,
			z: z
		};
	}
	else {
		var px = x / this.config.width * wid + bb.left;
		var py = y / this.config.height * hei + bb.top;
		
		
		return {
			x: px,
			y: py
		}
	}
}

Visualizer.prototype.getClosestPoint = function(mx, my, resultAsIndex) {
    
    // TODO replace with an efficient search structure such as M-Tree.
    // TODO handle multidimensional case with a general query point.
    var check = Number.MAX_VALUE;
    var result = null;
    var points = this.config.points;
    
    for (var item in points) {
		var p = this.fitToBoundingBox(points[item]);
		var dist = Math.pow(p.x - mx, 2) + Math.pow(p.y - my, 2);
		
		if (dist < check) {
			check = dist;
			result = resultAsIndex ? item : points[item];
		}
    }
    
    return result;
}

Visualizer.prototype.drawLine = function(line, noStroke) {
	
	var b = this.fitToBoundingBox(line.begin);
    var e = this.fitToBoundingBox(line.end);
    
	if (!noStroke) this.context.beginPath();
    this.context.moveTo(b.x, b.y);
    this.context.lineTo(e.x, e.y);
	if (!noStroke) this.context.stroke();
}

Visualizer.prototype.__scaleStr = function(scale) {
	var s = 'translateX(-50%) translateY(-50%) scaleX(' + scale + ') scaleY(' + scale + ')';
	return s;
}

Visualizer.prototype.drawPoint = function(item, noStroke) {
    var p0 = this.config.points[item];
    var p = this.fitToBoundingBox(p0);
	
	if (this.config.mode === 'canvas') {
		if (p.inside === true) {
	
			var pointSize = this.config.pointSize / 2;
			
			if (!noStroke) this.context.beginPath();
			this.context.moveTo(p.x - pointSize, p.y - pointSize);
			this.context.lineTo(p.x + pointSize, p.y - pointSize);
			this.context.lineTo(p.x + pointSize, p.y + pointSize);
			this.context.lineTo(p.x - pointSize, p.y + pointSize);
			this.context.lineTo(p.x - pointSize, p.y - pointSize);
			if (!noStroke) this.context.stroke();
		}
	}
	else {
		
		var scale = typeof(p['z']) === 'number' ? 1 / p.z : 1;
		var scaleStr = this.__scaleStr(scale * this.config.scaleFactor);
		var visible = p.z > 0.01;
		var point = this.place.find('.point[id="' + item + '"]');
		point.attr(
			'style',
			(visible ? '' : 'display: none; ') + 'position: absolute; left: ' + p.x + 'px; top: ' + p.y + 'px; z-index: ' + (1000 + Math.round(-p.z * 100)) + '; -webkit-transform: ' + scaleStr + '; -ms-transform: ' + scaleStr + '; transform: ' + scaleStr + '; -moz-transform: ' + scaleStr + ';'
		);
	}
}

Visualizer.prototype.draw = function(withOneStroke) {
    // TODO add ability to turn points and lines on and off.
	
    if (this.config.mode === 'canvas') {
		this.context.clearRect(0, 0, this.config.width, this.config.height);
		if (this.context === null) return;
	}
	
	var lines = this.config.lines;
	var points = this.config.points;
	
	// Begin path.
	if ((this.config.mode === 'canvas') && (!!withOneStroke)) this.context.beginPath();
	
	var counter = 0;
	for (var item in lines) {
		// Change color here, possibly sort lines by their color before loop and change only if needed.
		this.drawLine(lines[item], !!withOneStroke);
	}
	
	for (var item in points) {
		// Change color here, possibly sort points by their color before loop and change only if needed.
		this.drawPoint(item, !!withOneStroke);
	}
	
	if ((this.config.mode === 'canvas') && (!!withOneStroke)) this.context.stroke();
}
