import pandas as pd
from statsbombpy import sb
'''
Pulling the data from the StatsBomb API for Liverpool matches,
for season 15/16
than saving all events into one csv
'''

matches = sb.matches( competition_id=2, season_id=27)
liverpool_matches = matches[(matches["home_team"] == "Liverpool") | (matches["away_team"] == "Liverpool")]

liverpool_matches_ids = liverpool_matches["match_id"].tolist()
print(liverpool_matches_ids)


all_events = []

for match_id in liverpool_matches_ids:
    events = sb.events(match_id=match_id)
    events["match_id"] = match_id # damit man später nach spielen fitlern kann
    all_events.append(events)

liverpool_events = pd.concat(all_events, ignore_index=True)

liverpool_events.to_csv("liverpool_events_2015_2016.csv", index=False)
