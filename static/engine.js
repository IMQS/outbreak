function engine_onload() {
	var eng = new engine();

	if (eng.designMode) {
		eng.setupDesignMode();
	} else {
		var editor = CodeMirror.fromTextArea(document.getElementById('codeArea'), {
			autofocus: true,
			lineNumbers: true,
			theme: "eclipse",
			mode: "javascript"
		});
		editor.doc.setValue(engine_algo_line_txt);
		editor.setSize("100%", "50em");
		var run = function() {
			var pause = $('#pause').val();
			$('#' + eng.statusid).text(".");
			eng.stopInteractive();
			if (eng.loadNewCode(editor.doc.getValue())) {
				eng.resetWorld();
				eng.seed(0);
				eng.runInteractive(parseFloat(pause), 0);
			}
		};
		$('#run').click( function(e) {
			run();
		});
		run();
	}
}

var engine_world_width = 64;
var engine_world_height = 64;

var engine_start_x = 22;
var engine_start_y = 23;

var engine_ws_null = 0;
var engine_ws_sea = 1;
var engine_ws_land = 2;
var engine_ws_infected  = 3;
var engine_ws_barrier = 4;

var engine_simulate_count = 100;

var engine_status_game_over = "Game over";

function engine_algo_1(world) {
	var SEA = 1;
	var LAND = 2;
	var INFECTED = 3;
	var BARRIER = 4;

	// Pick the first LAND cell that is adjacent to an INFECTED cell
	for (var y = 1; y < world.height - 1; y++) {
		for (var x = 1; x < world.width - 1; x++) {
			if (world.get(x,y) != LAND)
				continue;
			var top = world.get(x, y - 1);
			var bottom = world.get(x, y + 1);
			var left = world.get(x - 1, y);
			var right = world.get(x + 1, y);
			if (top == INFECTED || bottom == INFECTED || left == INFECTED || right == INFECTED) {
				return [x,y];
			}
		}
	}

	// "pass".. ie do nothing.
	return null;
}

function engine_algo_line(world) {
	var SEA = 1;
	var LAND = 2;
	var INFECTED = 3;
	var BARRIER = 4;

	var y = 29;

	for (var x = 0; x < world.width; x++) {
		if (world.get(x,y) == LAND)
			return [x,y];
	}

	// "pass".. ie do nothing.
	return null;
}

var engine_algo_line_txt = 
"function barrier(world) {\n" +
"	var SEA = 1;\n" +
"	var LAND = 2;\n" +
"	var INFECTED = 3;\n" +
"	var BARRIER = 4;\n" +
"\n" +
"	var y = 29;\n" +
"\n" +
"	for (var x = 0; x < world.width; x++) {\n" +
"		if (world.get(x,y) == LAND)\n" +
"			return [x,y];\n" +
"	}\n" +
"\n" +
"	// \"pass\".. ie do nothing.\n" +
"	return null;\n" +
"}\n";


function engine() {
	this.seed(0);
	//this.algo = engine_algo_1;
	this.algo = engine_algo_line;
	this.spreadRate = 0.30;
	this.mapid = "map";
	this.pauseid = "pause";
	this.statusid = "status";
	this.world = new Array(engine_world_width * engine_world_height)
	this.world.width = engine_world_width;
	this.world.height = engine_world_height;
	this.world.get = function(x,y) { return this[Math.floor(y) * engine_world_height + Math.floor(x)]; }
	for (var i = 0; i < engine_world_width * engine_world_height; i++)
		this.world[i] = engine_ws_land;

	this.resetWorld();

	// visualization state
	this.designMode = false;
	this.lastInfection = null;
	this.lastBarrier = null;
	this.lastWarning = null;
	this.runTimer = null;
}

engine.prototype.seed = function(seed) {
	Math.seedrandom(seed);
}

engine.prototype.resetWorld = function() {
	var circle = false;
	if (circle) {
		for (var y = 0; y < engine_world_height; y++) {
			for (var x = 0; x < engine_world_width; x++) {
				var dx = x - engine_world_width / 2;
				var dy = y - engine_world_height / 2;
				var d = Math.sqrt(dx * dx + dy * dy);
				if (d > 28)
					this.set(x, y, engine_ws_sea);
			}
		}
	} else {
		for (var i = 0; i < engine_base_world.length; i++)
			this.world[i] = engine_base_world[i];
	}
	this.set(engine_start_x, engine_start_y, engine_ws_infected);
}

engine.prototype.countInfected = function() {
	var n = 0;
	for (var i = 0; i < engine_world_width * engine_world_height; i++)	
		n += this.world[i] == engine_ws_infected ? 1 : 0;
	return n;
}

engine.prototype.getXYFromCanvas = function(canvasID, x, y) {
	var canvas = document.getElementById(canvasID);
	var rect = canvas.getBoundingClientRect();
	x -= rect.left;
	y -= rect.top;
	return {"x": this.world.width * x / canvas.width, "y": this.world.height * y / canvas.height};
}

engine.prototype.get = function(x, y) {
	return this.world[Math.floor(y) * engine_world_width + Math.floor(x)];
}

engine.prototype.set = function(x, y, v) {
	this.world[Math.floor(y) * engine_world_width + Math.floor(x)] = v;
}

engine.prototype.step = function() {
	// Find a legal move for the virus spread
	var candidates = [];
	for (var y = 1; y < engine_world_height - 1; y++) {
		for (var x = 1; x < engine_world_width - 1; x++) {
			if (this.get(x,y) != engine_ws_land)
				continue;
			var top = this.get(x, y - 1);
			var bottom = this.get(x, y + 1);
			var left = this.get(x - 1, y);
			var right = this.get(x + 1, y);
			if (top == engine_ws_infected || bottom == engine_ws_infected || left == engine_ws_infected || right == engine_ws_infected) {
				candidates.push({"x": x, "y": y});
			}
		}
	}

	// Game over
	if (candidates.length == 0)
		return engine_status_game_over;

	var numMoves = Math.floor(Math.random() * candidates.length * this.spreadRate);
	numMoves = Math.min(numMoves, candidates.length);
	numMoves = Math.max(numMoves, 1);

	for (; numMoves != 0; numMoves--) {
		var ipick = Math.floor((Math.random() - 1e-9) * candidates.length);
		var pick = candidates[ipick];
		this.set(pick.x, pick.y, engine_ws_infected);
		candidates.splice(ipick, 1);
	}

	var xy = this.algo(this.world);
	if (xy == null) {
		// This is a 'pass'
		return null;
	}
	if (typeof xy != "object" || !Array.isArray(xy) || xy.length != 2 || xy[0] < 0 || xy[0] >= engine_world_width || xy[1] < 0 || xy[1] >= engine_world_height)
		return "Illegal return value. Must be an array of 2 elements [x,y] within the world bounds of " + engine_world_height + " x " + engine_world_height;

	if (this.get(xy[0], xy[1]) != engine_ws_land) {
		this.lastWarning = "Wasted move. Cell was not Land";
		return null;
	}

	this.set(xy[0], xy[1], engine_ws_barrier);

	return null;
}

engine.prototype.runToEnd = function() {
	while (true) {
		var r = this.step();
		if (r != null)
			return r;
	}
}

engine.prototype.loadNewCode = function(code) {
	barrier = null;
	var res = "";
	try {
		eval(code);
	} catch (e) {
		res = e;
	}
	this.algo = barrier;
	if (res != "")
		$('#' + this.statusid).text(res);
	return barrier != null;
}

engine.prototype.runSimulation = function() {
	var total = 0;
	for (var i = 0; i < engine_simulate_count; i++) {
		this.seed(0);
		this.resetWorld();
		var r = this.runToEnd();
		if (r != engine_status_game_over)
			return r;
		total += this.countInfected();
	}
	return total / engine_simulate_count;
}

engine.prototype.runInteractive = function(pauseMS, step) {
	var self = this;
	var res = this.step();
	if (res == null) {
		if (pauseMS == 0) {
			if (step % 5 == 0)
				this.draw(this.mapid);
		} else {
			this.draw(this.mapid);
		}
	} else {
		this.draw(this.mapid);
		if (res == engine_status_game_over) {
			res = "Days: " + this.countInfected();
		}
		$('#' + this.statusid).text(res);
		return;
	}

	this.runTimer = setTimeout( function() {
		self.runInteractive(pauseMS, step + 1);
	}, pauseMS);
}

engine.prototype.stopInteractive = function() {
	if (this.runTimer != null)
		clearTimeout(this.runTimer);
}

engine.prototype.draw = function(canvasId) {
	var c = document.getElementById(canvasId);
	var ctx = c.getContext("2d");
	var bgimg = null;
	if (this.designMode) {
		bgimg = new Image();
		bgimg.src = 'bgmap.png';
	}
	c.width = c.width;
	ctx.strokeStyle = '';
	if (this.designMode)
		ctx.drawImage(bgimg, 0, 0, c.width, c.height);
	var scalex = c.width / this.world.width;
	var scaley = c.height / this.world.height;
	for (var y = 0; y < this.world.height; y++) {
		for (var x = 0; x < this.world.width; x++) {
			var s = this.get(x,y);
			if (s == engine_ws_sea)           ctx.fillStyle = "rgba( 51, 133, 255, 1.0)";
			else if (s == engine_ws_land)     ctx.fillStyle = "rgba(  0, 138,  46, 1.0)";
			else if (s == engine_ws_infected) ctx.fillStyle = "rgba(209,  62,  25, 1.0)";
			else if (s == engine_ws_barrier)  ctx.fillStyle = "rgba( 64,  64,  64, 1.0)";
			ctx.fillRect(x * scalex, y * scaley, scalex, scaley);
		}
	}
}

engine.prototype.setupDesignMode = function() {
	var eng = this;
	var mstate = engine_ws_null;
	$("#" + mapid).mousedown( function(e) {
		if (e.button == 2) {
			eng.dumpToConsole();
		} else {
			var cell = eng.getXYFromCanvas(mapid, e.clientX, e.clientY);
			mstate = eng.get(cell.x, cell.y) == engine_ws_sea ? engine_ws_land : engine_ws_sea;
		}
	});
	$("#" + mapid).mouseup( function(e) {
		mstate = engine_ws_null;
	});
	$("#" + mapid).mouseout( function(e) {
		mstate = engine_ws_null;
	});
	$("#" + mapid).mousemove( function(e) {
		if (mstate != engine_ws_null) {
			var cell = eng.getXYFromCanvas(mapid, e.clientX, e.clientY);
			if (cell.x >= 0 && cell.x < eng.world.width && cell.y >= 0 && cell.y < eng.world.height) {
				if (eng.get(cell.x, cell.y) != mstate) {
					eng.set(cell.x, cell.y, mstate);
					eng.draw(mapid);
				}
			}
		}
	});
	var bgimg = new Image();
	bgimg.src = 'bgmap.png';
	bgimg.onload = function() {
		eng.step();
		eng.draw(mapid);
	};
}

engine.prototype.dumpToConsole = function() {
	var s = "var engine_base_world = [";
	for (var i = 0; i < this.world.width * this.world.height; i++) {
		if (i % 64 == 0)
			s += "\n\t";
		s += this.world[i] + ",";
	}
	s = s.substr(0, s.length - 1);
	s += "];\n";
	console.log(s);
}

var engine_base_world = [
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,2,2,1,1,1,1,1,1,1,
	1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,1,1,1,1,1,1,
	1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,
	1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,
	1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,
	1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,
	1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,2,2,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,2,2,2,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,2,2,2,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,2,2,2,2,2,2,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,2,2,2,2,2,2,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,2,2,2,2,2,2,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,2,2,2,2,2,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,2,2,2,2,2,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,2,2,2,2,2,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,2,2,2,2,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];