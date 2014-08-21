function Player(p) {
	this.name = p["Name"];
	this.code = p["Code"];
	this.score = p["Score"];
	this.engine;
}

Player.prototype.render = function(divId) {
	var mapId = divId + "-map";
	var html = "<td class='leaderboard-map'><canvas class='leaderboard-map-canvas' id='" + mapId + "'></canvas></td>" +
		"<td class='leaderboard-name'>" +
		this.name +
		"</td>" +
		"<td class='leaderboard-score'>" +
		this.score +
		"</td>";
	$("#"+divId).append(html);
	try {
		this.engine.draw(mapId);
		this.engine.runInteractive(10, 0);
	} catch(e) {
		console.log("Failed to render bad code");
	}
};

function LeaderBoard() {
	this.players = [];
}

LeaderBoard.prototype.loadFromServer = function() {
	$.get("/getall", function(json) {
		this.players = [];
		for (var p_key in json) {
			if (json.hasOwnProperty(p_key)) {
				var player = new Player(json[p_key]);
				player.engine = new engine();
				try {
					player.engine.loadNewCode(player.code);
				} catch(e) {
					console.log("Failed to load bad code");
				}
				this.players.push(player);
			}
		}
		this.players = this.players.filter( function(el) {return(el.score > 0)} );
		this.players.sort( function(a,b){
			return (a.score - b.score);
		});
		this.render();
	}.bind(this));
};

LeaderBoard.prototype.render = function() {
	$("#leaderboard").empty();
	for (var i = 0; (i < this.players.length) && (i < 10); i++) {
		var rowid = "leaderboard-row-" + i;
		$("#leaderboard").append("<tr id='" + rowid + "' class='leaderboard-row'></tr>");
		this.players[i].render(rowid);
	}
};

function leader_onload() {
	var lb = new LeaderBoard();
	lb.loadFromServer();
	window.setInterval(lb.loadFromServer.bind(lb), 10000);
}
