FIBBAGE XL - BEHIND THE BLUFF
Built by Dez's Minion

Start: npm start
The server listens on process.env.PORT, defaulting to 3000.
Open the server URL in your browser or the Orb preview.
No application dependencies are required.

The supplied archive contains 331 question truths and 5,966 built-in lie
suggestions. The searchable archive includes both normal and final rounds.
Select a question to inspect its complete answer and suggestions.
Export data downloads all question records as JSON.

F6 toggles the companion mod menu while this page has focus. It controls
answer/suggestion visibility and provides shortcuts to answers and players.
This is not a native game modification or a global/in-game overlay.

Connected users and player-written lies are not present in the ZIP.
The Players view supports importing an authorized host snapshot:

{
  "players": [
    {"id": "1", "name": "Dez", "score": 1000, "connected": true}
  ],
  "questionId": 14263,
  "lies": [{"text": "mimes", "playerId": "1"}]
}

Only players is required. Each player requires a unique id and a name.
Optional fields: score, connected, questionId, lies. Lie entries require
text and may specify playerId. Unknown connection states remain unknown.
Snapshots stay in the current browser tab's memory and are lost on reload.
No live connection, automatic game attachment, or network protocol is
implemented. The Archive findings view distinguishes static SWF string
evidence from confirmed runtime capabilities.

Regenerate extracted data: npm run analyze
This reads the uploaded ZIP without executing the game or changing it.
Run the included targeted checks: npm test
