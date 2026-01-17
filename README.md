# Liverpool Offense Radar & Shot Map

A static D3 visualization for analyzing Liverpool’s offense (2015/16 season): a radar chart with team percentiles, a shot map on the pitch, and a bar chart of goals scored.

---

## How to use the GitHub Pages website

### 1) Select a player (Radar)
- Select a player via the dropdown **or** click a player in the **Top-10 lists** on the right.
- The radar shows percentiles for **Overview** and detailed categories (Finishing, Creation, Progression, Dribbling).
- The selection is passed to the shot map.

### 2) Shot Map (Pitch)
- Select a match in the dropdown.
- Default is **This match only**. If a player is selected, you can switch to **All matches (season)**.
- **Clear player** removes the player filter.
- Shot map usage (how to interact):
When you select a player in the radar, the shot map automatically filters to that player. If the map looks empty, it likely means the selected player did not take any shots in the currently chosen match.
In that case, switch the match dropdown or toggle to All matches (season) (only available after a player is selected) to see that player’s season shots.
You can also click Clear player to return to all shots for the match.
Hover over a shot to view details (player, minute, outcome, xG), and click a shot to show the freeze‑frame player positions,
click anywhere on the pitch to close the freeze‑frame view. If no shot markers appear after changing matches, just keep browsing the match dropdown—some matches contain few or no shots for the selected player.
- Freeze‑frame (360) view
Click any shot marker to open the freeze‑frame (360) view. It plots nearby player positions at the moment of the shot:
teammates in blue and opponents in red. A small legend appears on the pitch, and you can click anywhere on the pitch to close the freeze‑frame and return to the full shot map

**Interaction:**
- Hover a shot -> info box with player, minute, outcome, xG, etc.
- Click a shot -A freeze frame shows player positions; click on the pitch to exit.

### 3) Goals by Player (Bar Chart)
- **Min goals** filters players.
- **Sort** toggles between ascending and descending order.

---
