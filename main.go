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

type errorString struct {
	s string
}

func (e *errorString) Error() string {
	return e.s
}

func upsertPlayer(key string, new_p Player) error {
	if p, ok := players[key]; ok {
		log.Println("Updating player : " + key)
		if new_p.Name != "" {
			//log.Println("Updating name for " + key + " to " + new_p.Name)
			p.Name = new_p.Name
		}
		if new_p.Score != 0 {
			if (p.Score != 0) && (new_p.Score >= p.Score) {
				return &errorString{"This score is not better than your previous score"}
			}
			//log.Println("Updating score for " + key + " to " + strconv.Itoa(new_p.Score))
			p.Score = new_p.Score
		}
		if new_p.Code != "" {
			//log.Println("Updating code for " + key + " to " + new_p.Code)
			p.Code = new_p.Code
		}
	} else {
		log.Printf("Inserting new player : %v\n", key)
		players[key] = &new_p
	}
	return nil
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
	if err = upsertPlayer(key, p); err != nil {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(err.Error()))
		m.Unlock()
		return
	}
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

func getCodeHandler(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Path[len("/getCode/"):]
	w.Header().Set("Content-Type", "text/plain")
	m.Lock()
	if player, ok := players[key]; ok {
		w.Write([]byte(player.Code))
	} else {
		w.Write([]byte(""))
	}
	m.Unlock()
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

func serveProtected() {
	defer func() {
		if err := recover(); err != nil {
			log.Printf("Panic: %v\n", err)
		}
	}()
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Printf("ListenAndServe error: %v\n", err)
	}
}

func main() {
	readFromFile()
	http.Handle("/static/", http.FileServer(http.Dir("./")))
	http.HandleFunc("/upsert/", upsertHandler)
	http.HandleFunc("/getall", getAllHandler)
	http.HandleFunc("/getCode/", getCodeHandler)

	for {
		serveProtected()
	}
}
