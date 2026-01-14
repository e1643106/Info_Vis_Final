import os
import json
import math
import numpy as np
import pandas as pd


def minmax(s: pd.Series) -> pd.Series:
    """
    Min-Max-Scaling, NaNs bleiben NaNs.
    Wenn alle Werte NaN -> alles NaN.
    Wenn alle gültigen Werte gleich -> diese bekommen 0.5.
    """
    s = pd.to_numeric(s, errors="coerce")
    mask = s.notna()

    if not mask.any():
        return pd.Series(np.nan, index=s.index)

    s_valid = s[mask]
    min_ = s_valid.min()
    max_ = s_valid.max()

    if max_ == min_:
        out = pd.Series(np.nan, index=s.index)
        out[mask] = 0.5
        return out

    out = (s - min_) / (max_ - min_)
    return out


def is_in_final_third(loc):
    if not loc:
        return False
    x, y = loc
    return x >= 80.0


def is_in_box(loc):
    if not loc:
        return False
    x, y = loc
    return (x >= 102.0) and (18.0 <= y <= 62.0)


def is_in_deep_zone(loc):
    if not loc:
        return False
    x, y = loc
    dx = x - 120.0
    dy = y - 40.0
    return math.sqrt(dx * dx + dy * dy) <= 20.0


TOUCH_TYPES = {
    "Ball Receipt*",
    "Pass",
    "Carry",
    "Shot",
    "Dribble",
}


def compute_finishing_and_touches_for_match(events, team_name="Liverpool"):
    per_player = {}

    for ev in events:
        team = ev.get("team", {})
        if team.get("name") != team_name:
            continue

        ev_type = (ev.get("type") or {}).get("name")
        loc = ev.get("location")
        under_pressure = ev.get("under_pressure", False)

        player_info = ev.get("player", {})
        player_id = player_info.get("id")
        player_name = player_info.get("name", "Unknown")

        if player_id is None:
            continue

        stats = per_player.setdefault(
            player_id,
            {
                "player_id": player_id,
                "player_name": player_name,

                # Shots
                "shots": 0,
                "goals": 0,
                "xg": 0.0,
                "execution_value_sum": 0.0,
                "shots_up": 0,
                "goals_up": 0,
                "xg_up": 0.0,
                "execution_value_sum_up": 0.0,

                # Touches 
                "touches_final_third": 0,
                "touches_in_box": 0,
                "deep_touches": 0,
                "deep_completions": 0,
                "touches_final_third_up": 0,
                "touches_in_box_up": 0,
                "deep_touches_up": 0,
                "deep_completions_up": 0,

                # Chance Creation
                "key_passes_final_third": 0,
                "assists_final_third": 0,
                "passes_into_box": 0,
                "passes_into_deep_zone": 0,
                "key_passes_final_third_up": 0,
                "assists_final_third_up": 0,
                "passes_into_box_up": 0,
                "passes_into_deep_zone_up": 0,

                # Deep Progressions
                "deep_progressions_pass": 0,
                "deep_progressions_carry": 0,
                "deep_progressions_pass_deep": 0,
                "deep_progressions_carry_deep": 0,
                "deep_progressions_pass_up": 0,
                "deep_progressions_carry_up": 0,
                "deep_progressions_pass_deep_up": 0,
                "deep_progressions_carry_deep_up": 0,

                # Dribbling / On-Ball
                "dribbles_attempted_ft": 0,
                "dribbles_completed_ft": 0,
                "dribbles_attempted_ft_up": 0,
                "dribbles_completed_ft_up": 0,
                "miscontrols_ft": 0,
                "miscontrols_ft_up": 0,
                "dispossessed_ft": 0,
                "dispossessed_ft_up": 0,
                "fouls_won_ft": 0,
                "fouls_won_ft_up": 0,
            },
        )

        # Shots F3
        if ev_type == "Shot" and is_in_final_third(loc):
            shot = ev.get("shot", {})
            xg = float(shot.get("statsbomb_xg", 0.0))
            outcome = (shot.get("outcome") or {}).get("name")
            y = 1 if outcome == "Goal" else 0
            execution_value = y - xg

            stats["shots"] += 1
            stats["goals"] += y
            stats["xg"] += xg
            stats["execution_value_sum"] += execution_value

            if under_pressure:
                stats["shots_up"] += 1
                stats["goals_up"] += y
                stats["xg_up"] += xg
                stats["execution_value_sum_up"] += execution_value

        # Touches
        if ev_type in TOUCH_TYPES and loc is not None:
            in_ft = is_in_final_third(loc)
            in_box = is_in_box(loc)
            in_deep = is_in_deep_zone(loc)

            if in_ft:
                stats["touches_final_third"] += 1
                if under_pressure:
                    stats["touches_final_third_up"] += 1

            if in_box:
                stats["touches_in_box"] += 1
                if under_pressure:
                    stats["touches_in_box_up"] += 1

            if in_deep:
                stats["deep_touches"] += 1
                if under_pressure:
                    stats["deep_touches_up"] += 1

        # Deep Completions
        end_loc = None
        is_completion = False

        if ev_type == "Pass":
            p = ev.get("pass", {})
            end_loc = p.get("end_location")
            outcome = p.get("outcome")
            is_completion = outcome is None

        elif ev_type == "Carry":
            c = ev.get("carry", {})
            end_loc = c.get("end_location")
            is_completion = True

        elif ev_type == "Ball Receipt*":
            end_loc = loc
            br = ev.get("ball_receipt", {})
            outcome = br.get("outcome")
            is_completion = outcome is None

        if is_completion and is_in_deep_zone(end_loc):
            stats["deep_completions"] += 1
            if under_pressure:
                stats["deep_completions_up"] += 1

        # Pass: Chance Creation + Deep Progression 
        if ev_type == "Pass":
            p = ev.get("pass", {})
            start_ft = is_in_final_third(loc)
            pend = p.get("end_location")
            end_box = is_in_box(pend)
            end_deep = is_in_deep_zone(pend)

            is_key_pass = bool(p.get("shot_assist")) or (
                p.get("assisted_shot_id") is not None
            )
            is_assist = bool(p.get("goal_assist"))
            p_outcome = p.get("outcome")
            is_completed = p_outcome is None

            if start_ft and is_key_pass:
                stats["key_passes_final_third"] += 1
                if under_pressure:
                    stats["key_passes_final_third_up"] += 1

            if start_ft and is_assist:
                stats["assists_final_third"] += 1
                if under_pressure:
                    stats["assists_final_third_up"] += 1

            if is_completed and end_box:
                stats["passes_into_box"] += 1
                if under_pressure:
                    stats["passes_into_box_up"] += 1

            if is_completed and end_deep:
                stats["passes_into_deep_zone"] += 1
                if under_pressure:
                    stats["passes_into_deep_zone_up"] += 1

            if loc is not None and pend is not None:
                start_outside_ft = not is_in_final_third(loc)
                end_in_ft = is_in_final_third(pend)

                if is_completed and start_outside_ft and end_in_ft:
                    stats["deep_progressions_pass"] += 1
                    if under_pressure:
                        stats["deep_progressions_pass_up"] += 1

                if is_completed and start_outside_ft and end_deep:
                    stats["deep_progressions_pass_deep"] += 1
                    if under_pressure:
                        stats["deep_progressions_pass_deep_up"] += 1

        # Carry: Deep Progression 
        if ev_type == "Carry":
            c = ev.get("carry", {})
            c_end = c.get("end_location")

            if loc is not None and c_end is not None:
                start_outside_ft = not is_in_final_third(loc)
                end_in_ft = is_in_final_third(c_end)
                end_deep = is_in_deep_zone(c_end)

                if start_outside_ft and end_in_ft:
                    stats["deep_progressions_carry"] += 1
                    if under_pressure:
                        stats["deep_progressions_carry_up"] += 1

                if start_outside_ft and end_deep:
                    stats["deep_progressions_carry_deep"] += 1
                    if under_pressure:
                        stats["deep_progressions_carry_deep_up"] += 1

        #  Dribbling On-Ball 
        if ev_type == "Dribble" and loc is not None and is_in_final_third(loc):
            dr = ev.get("dribble", {})
            outcome_name = (dr.get("outcome") or {}).get("name")
            success = outcome_name == "Complete"

            stats["dribbles_attempted_ft"] += 1
            if success:
                stats["dribbles_completed_ft"] += 1

            if under_pressure:
                stats["dribbles_attempted_ft_up"] += 1
                if success:
                    stats["dribbles_completed_ft_up"] += 1

        if ev_type == "Miscontrol" and loc is not None and is_in_final_third(loc):
            stats["miscontrols_ft"] += 1
            if under_pressure:
                stats["miscontrols_ft_up"] += 1

        if ev_type == "Dispossessed" and loc is not None and is_in_final_third(loc):
            stats["dispossessed_ft"] += 1
            if under_pressure:
                stats["dispossessed_ft_up"] += 1

        if ev_type == "Foul Won" and loc is not None and is_in_final_third(loc):
            stats["fouls_won_ft"] += 1
            if under_pressure:
                stats["fouls_won_ft_up"] += 1

    return per_player


# ---------------------------------------------------
JSON_DIR = "/Users/salih/TU/informationsvisalusierung/liverpool_events_json"

all_player_stats = {}

for filename in os.listdir(JSON_DIR):
    if not filename.endswith(".json"):
        continue

    file_path = os.path.join(JSON_DIR, filename)
    print(f"📄 Lade {file_path} ...")

    with open(file_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    events = list(raw.values())
    match_stats = compute_finishing_and_touches_for_match(
        events, team_name="Liverpool"
    )

    for player_id, stats in match_stats.items():
        glob = all_player_stats.setdefault(
            player_id,
            {
                "player_id": player_id,
                "player_name": stats["player_name"],

                "shots": 0,
                "goals": 0,
                "xg": 0.0,
                "execution_value_sum": 0.0,
                "shots_up": 0,
                "goals_up": 0,
                "xg_up": 0.0,
                "execution_value_sum_up": 0.0,

                "touches_final_third": 0,
                "touches_in_box": 0,
                "deep_touches": 0,
                "deep_completions": 0,
                "touches_final_third_up": 0,
                "touches_in_box_up": 0,
                "deep_touches_up": 0,
                "deep_completions_up": 0,

                "key_passes_final_third": 0,
                "assists_final_third": 0,
                "passes_into_box": 0,
                "passes_into_deep_zone": 0,
                "key_passes_final_third_up": 0,
                "assists_final_third_up": 0,
                "passes_into_box_up": 0,
                "passes_into_deep_zone_up": 0,

                "deep_progressions_pass": 0,
                "deep_progressions_carry": 0,
                "deep_progressions_pass_deep": 0,
                "deep_progressions_carry_deep": 0,
                "deep_progressions_pass_up": 0,
                "deep_progressions_carry_up": 0,
                "deep_progressions_pass_deep_up": 0,
                "deep_progressions_carry_deep_up": 0,

                "dribbles_attempted_ft": 0,
                "dribbles_completed_ft": 0,
                "dribbles_attempted_ft_up": 0,
                "dribbles_completed_ft_up": 0,
                "miscontrols_ft": 0,
                "miscontrols_ft_up": 0,
                "dispossessed_ft": 0,
                "dispossessed_ft_up": 0,
                "fouls_won_ft": 0,
                "fouls_won_ft_up": 0,
            },
        )

        fields_to_sum = [
            "shots",
            "goals",
            "xg",
            "execution_value_sum",
            "shots_up",
            "goals_up",
            "xg_up",
            "execution_value_sum_up",
            "touches_final_third",
            "touches_in_box",
            "deep_touches",
            "deep_completions",
            "touches_final_third_up",
            "touches_in_box_up",
            "deep_touches_up",
            "deep_completions_up",
            "key_passes_final_third",
            "assists_final_third",
            "passes_into_box",
            "passes_into_deep_zone",
            "key_passes_final_third_up",
            "assists_final_third_up",
            "passes_into_box_up",
            "passes_into_deep_zone_up",
            "deep_progressions_pass",
            "deep_progressions_carry",
            "deep_progressions_pass_deep",
            "deep_progressions_carry_deep",
            "deep_progressions_pass_up",
            "deep_progressions_carry_up",
            "deep_progressions_pass_deep_up",
            "deep_progressions_carry_deep_up",
            "dribbles_attempted_ft",
            "dribbles_completed_ft",
            "dribbles_attempted_ft_up",
            "dribbles_completed_ft_up",
            "miscontrols_ft",
            "miscontrols_ft_up",
            "dispossessed_ft",
            "dispossessed_ft_up",
            "fouls_won_ft",
            "fouls_won_ft_up",
        ]

        for key in fields_to_sum:
            glob[key] += stats.get(key, 0)


df = pd.DataFrame(all_player_stats.values())


# Einzelmetriken 
#  Rates etc...

# Per-Shot
df["xg_per_shot"] = df["xg"] / df["shots"].replace(0, pd.NA)
df["goals_per_shot"] = df["goals"] / df["shots"].replace(0, pd.NA)
df["execution_value_per_shot"] = df["execution_value_sum"] / df["shots"].replace(
    0, pd.NA
)

df["xg_per_shot_up"] = df["xg_up"] / df["shots_up"].replace(0, pd.NA)
df["goals_per_shot_up"] = df["goals_up"] / df["shots_up"].replace(0, pd.NA)
df["execution_value_per_shot_up"] = df["execution_value_sum_up"] / df[
    "shots_up"
].replace(0, pd.NA)

# Dribbling Succes
df["dribble_success_ft"] = df["dribbles_completed_ft"] / df[
    "dribbles_attempted_ft"
].replace(0, pd.NA)
df["dribble_success_ft_up"] = df["dribbles_completed_ft_up"] / df[
    "dribbles_attempted_ft_up"
].replace(0, pd.NA)

# spacial Shares / Rates
df["box_touch_share"] = df["touches_in_box"] / df["touches_final_third"].replace(
    0, np.nan
)
df["deep_touch_share"] = df["deep_touches"] / df["touches_final_third"].replace(
    0, np.nan
)

df["key_pass_rate"] = df["key_passes_final_third"] / df[
    "touches_final_third"
].replace(0, np.nan)
df["assist_rate"] = df["assists_final_third"] / df[
    "touches_final_third"
].replace(0, np.nan)
df["box_pass_rate"] = df["passes_into_box"] / df["touches_final_third"].replace(
    0, np.nan
)
df["deep_pass_rate"] = df["passes_into_deep_zone"] / df[
    "touches_final_third"
].replace(0, np.nan)

# Progression
df["prog_pass"] = df["deep_progressions_pass"] + 1.5 * df[
    "deep_progressions_pass_deep"
]
df["prog_carry"] = df["deep_progressions_carry"] + 1.5 * df[
    "deep_progressions_carry_deep"
]

# Fouls / lossses
df["fouls_won_rate"] = df["fouls_won_ft"] / df["touches_final_third"].replace(
    0, np.nan
)
df["bad_touches"] = df["miscontrols_ft"] + df["dispossessed_ft"]


# Categories , Scores for the Radar

# Finishing / xG
fin_goals = minmax(df["goals_per_shot"])
fin_exec = minmax(df["execution_value_per_shot"])
fin_box = minmax(df["box_touch_share"])
fin_deep = minmax(df["deep_touch_share"])

fin_components = pd.concat([fin_goals, fin_exec, fin_box, fin_deep], axis=1)
df["finishing_score"] = fin_components.mean(axis=1, skipna=True)
fin_all_nan = fin_components.isna().all(axis=1)
df.loc[fin_all_nan, "finishing_score"] = np.nan

# Chance Creation
ch_key = minmax(df["key_pass_rate"])
ch_ast = minmax(df["assist_rate"])
ch_box = minmax(df["box_pass_rate"])
ch_deep = minmax(df["deep_pass_rate"])

ch_components = pd.concat([ch_key, ch_ast, ch_box, ch_deep], axis=1)
df["chance_creation_score"] = ch_components.mean(axis=1, skipna=True)
ch_all_nan = ch_components.isna().all(axis=1)
df.loc[ch_all_nan, "chance_creation_score"] = np.nan

# Ball Progression
prog_pass_n = minmax(df["prog_pass"])
prog_carry_n = minmax(df["prog_carry"])

prog_components = pd.concat([prog_pass_n, prog_carry_n], axis=1)
df["progression_score"] = prog_components.mean(axis=1, skipna=True)
prog_all_nan = prog_components.isna().all(axis=1)
df.loc[prog_all_nan, "progression_score"] = np.nan

# Dribbling / On-Ball
drib_succ_n = minmax(df["dribble_success_ft"])
foul_rate_n = minmax(df["fouls_won_rate"])

bad_norm = minmax(df["bad_touches"])
clean_on_ball_n = 1 - bad_norm  # weniger Fehler -> höherer Wert

drib_components = pd.concat([drib_succ_n, foul_rate_n, clean_on_ball_n], axis=1)
df["dribbling_onball_score"] = drib_components.mean(axis=1, skipna=True)

# players without touches in final third -> no dribbling/on-ball score
no_ft_touches = df["touches_final_third"] == 0
df.loc[no_ft_touches, "dribbling_onball_score"] = np.nan

drib_all_nan = drib_components.isna().all(axis=1)
df.loc[drib_all_nan, "dribbling_onball_score"] = np.nan


# big csv with all metrics
full_out = "liverpool_shot_metrics.csv"
df.to_csv(full_out, index=False)
print(f"✅ Vollständige Metrik-Datei gespeichert in: {full_out}")


# radar CSV with categories + percentiles
radar_df = df[
    [
        "player_id",
        "player_name",
        "finishing_score",
        "chance_creation_score",
        "progression_score",
        "dribbling_onball_score",
    ]
].copy()

score_cols = [
    "finishing_score",
    "chance_creation_score",
    "progression_score",
    "dribbling_onball_score",
]

for col in score_cols:
    radar_df[col + "_pct"] = radar_df[col].rank(pct=True)

radar_out = "liverpool_offense_radar.csv"
radar_df.to_csv(radar_out, index=False)

