// main.go
package main

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"sync"
)

type Player struct {
	Name  string
	Code  string
	Score float64
}

var players map[string]*Player

var m sync.Mutex

func upsertPlayer(key string, new_p Player) {
	if p, ok := players[key]; ok {
		log.Println("Updating player : " + key)
		if new_p.Name != "" {
			//log.Println("Updating name for " + key + " to " + new_p.Name)
			p.Name = new_p.Name
		}
		if new_p.Code != "" {
			//log.Println("Updating code for " + key + " to " + new_p.Code)
			p.Code = new_p.Code
		}
		if new_p.Score != 0 {
			//log.Println("Updating score for " + key + " to " + strconv.Itoa(new_p.Score))
			p.Score = new_p.Score
		}
	} else {
		log.Printf("Inserting new player : %v\n", key)
		players[key] = &new_p
	}
}

func gameHandler(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "./static/game.html")
}

func leaderboardHandler(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "./static/leaderboard.html")
}

func upsertHandler(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if err := recover(); err != nil {
			http.Error(w, err.(string), 403)
		}
	}()
	key := r.URL.Path[len("/upsert/"):]
	decoder := json.NewDecoder(r.Body)
	var p Player
	err := decoder.Decode(&p)
	if err != nil {
		panic("Could not decode JSON")
	}

	m.Lock()
	upsertPlayer(key, p)
	savePlayersToFile()
	m.Unlock()

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte("Entry received"))
}

func getAllHandler(w http.ResponseWriter, r *http.Request) {
	js, err := json.Marshal(players)
	if err != nil {
		panic("Could not marshal JSON")
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(js)
}

func savePlayersToFile() {
	log.Println("Saving players to file")
	js, err := json.MarshalIndent(players, "", "    ")
	if err != nil {
		panic("Could not marshal JSON")
	}
	err = ioutil.WriteFile("players.json", js, 0644)
	if err != nil {
		panic(err)
	}
}

func readFromFile() {
	log.Println("Reading players from file")
	b, err := ioutil.ReadFile("players.json")
	if err != nil {
		panic(err)
	}
	err = json.Unmarshal(b, &players)
	if err != nil {
		panic(err)
	}
}

func main() {
	readFromFile()
	//http.HandleFunc("/game", gameHandler)
	//http.HandleFunc("/leaderboard", leaderboardHandler)
	http.HandleFunc("/upsert/", upsertHandler)
	http.HandleFunc("/getall", getAllHandler)

	// Normal resources
	//http.Handle("/static", http.FileServer(http.Dir("./static/")))
	http.Handle("/", http.FileServer(http.Dir("./")))

	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
