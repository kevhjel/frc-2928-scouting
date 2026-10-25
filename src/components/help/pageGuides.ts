export interface GuideSection {
  heading: string;
  items: string[];
}

export interface PageGuide {
  /** Stable key, used to remember which guides a user has opened */
  id: string;
  title: string;
  intro: string;
  sections: GuideSection[];
}

const guides: { matchPrefix: string; guide: PageGuide }[] = [
  {
    matchPrefix: "/scout",
    guide: {
      id: "scout",
      title: "Scout",
      intro: "Record what one robot does during a match. Each scout watches one robot per match.",
      sections: [
        {
          heading: "Picking a robot",
          items: [
            "Your assignments are listed here. NEXT (yellow) is your upcoming match; ✓ Done (green) is already submitted. Tap an assignment to start.",
            "Not assigned? Choose a match from the Match dropdown, then tap a team. Red teams are on top, blue below.",
            "In the dropdown, ⚠ means some robots in that match are scouted and ✓ means all six are.",
            "Choose Practice match to scout a practice round: enter the practice number, team and alliance by hand.",
          ],
        },
        {
          heading: "Filling out the form",
          items: [
            "The tabs at the top (Auto, Teleop, …) switch between sections. Fill in each one as the match plays out.",
            "In the Notes section, add Quick Tags such as Tip Risk or Strong Defense, or type your own.",
            "Have a question for the team's pit crew? Type it in Pit Questions and tap Send.",
            "Tap the green Submit button when the match ends. Discard & go back throws the entry away.",
          ],
        },
        {
          heading: "No Wi-Fi?",
          items: [
            "Keep scouting. Entries are saved on your device and sent automatically when you reconnect.",
            "A banner shows how many entries are queued. Tap Retry Now to send them right away.",
          ],
        },
      ],
    },
  },
  {
    matchPrefix: "/pit",
    guide: {
      id: "pit",
      title: "Pit Scouting",
      intro: "Interview teams in the pits about their robot before matches.",
      sections: [
        {
          heading: "Choosing a team",
          items: [
            "Tap a team card to open its pit form. A green ✓ means the team has already been pit scouted.",
            "Tap ← Back to return to the team grid.",
          ],
        },
        {
          heading: "The pit form",
          items: [
            "A New badge means nobody has scouted this team yet. Editing means you're updating an existing entry, and your changes replace it.",
            "Add Robot Photos lets you take or attach pictures. Tap a photo to enlarge it, or remove it from there.",
            "Scout Questions lists questions match scouts asked about this team. Type an answer while you're at their pit.",
            "Tap Save Pit Entry (or Update Pit Entry) when you're done.",
          ],
        },
      ],
    },
  },
  {
    matchPrefix: "/data",
    guide: {
      id: "data",
      title: "Data",
      intro: "Compare every team at the event using scouting data plus OPR and EPA from The Blue Alliance and Statbotics.",
      sections: [
        {
          heading: "Table view",
          items: [
            "Tap any column header to sort by it. Tap it again to flip the order.",
            "Use Search teams… to find a team by number or name.",
            "Flags shows tags scouts added, like Tip Risk or DNP.",
            "Tap a team row to open its full Team page.",
          ],
        },
        {
          heading: "Chart view",
          items: [
            "Switch to Chart for a bubble chart of all teams.",
            "Pick any two stats for the X Axis and Y Axis. Teams up and to the right are strong in both.",
          ],
        },
        {
          heading: "What the numbers mean",
          items: [
            "OPR: The Blue Alliance's estimate of points a team adds to its alliance.",
            "EPA: Statbotics' estimate of a team's expected points per match.",
            "Avg / Max Match Balls: from our own scouting entries.",
          ],
        },
      ],
    },
  },
  {
    matchPrefix: "/team",
    guide: {
      id: "team",
      title: "Team Page",
      intro: "Everything we know about one team, all in one place.",
      sections: [
        {
          heading: "What's here",
          items: [
            "Performance (vs. event): a radar chart comparing this team to the event average.",
            "Average Stats and Maximum Stats come from all scouting entries for the team.",
            "Pit Scouting shows their pit interview answers and photos. Notes and Pit Questions are listed below that.",
            "Scroll down for every match entry. Tap one to expand it, or tap ▶ Watch to see the match video.",
          ],
        },
        {
          heading: "Flags",
          items: [
            "Tap Add Flag to tag the team (for example Mechanical Issues or Standout), with an optional note.",
            "Flags show up for everyone on the Data, Pick List and Team pages. Tap ✕ on a flag to remove it.",
          ],
        },
      ],
    },
  },
  {
    matchPrefix: "/match-analysis",
    guide: {
      id: "match-analysis",
      title: "Match Analysis",
      intro: "Preview any match: who is on each alliance and how strong they are. Great for strategy before our matches.",
      sections: [
        {
          heading: "Using it",
          items: [
            "Pick a match from the list. Matches with our team are highlighted with ★ My Team.",
            "Each alliance gets a column with a card for every robot, showing Skills, Offense, match notes and pit notes.",
            "Alliance Summary estimates balls per match, defense quality and how well the alliance handles defense.",
            "\"no data\" means nobody has scouted that robot yet.",
            "Tap a robot's photo or name to open a box where you can send our pit crew a question about that team.",
          ],
        },
        {
          heading: "Schedule updates",
          items: [
            "The match schedule and scores sync from The Blue Alliance automatically. The header shows when it last synced.",
            "Admins can tap Sync Now to refresh right away.",
          ],
        },
      ],
    },
  },
  {
    matchPrefix: "/picklist",
    guide: {
      id: "picklist",
      title: "Pick List",
      intro: "Rank the teams you'd want as alliance partners. Everyone's lists are combined into one team-wide list.",
      sections: [
        {
          heading: "My List",
          items: [
            "Drag teams by the ⠿ handle to reorder them. Your list saves automatically.",
            "Mark a team DNP (Do Not Pick) to move it to the bottom.",
            "Add notes on a row to remember why you ranked a team there.",
            "Tap a team number to see a quick summary of its stats and notes.",
            "When you're happy with your list, check Ready. Only Ready lists count toward the Team List.",
          ],
        },
        {
          heading: "Team List",
          items: [
            "Admins tap Generate to combine everyone's Ready lists. Each team's position comes from its average rank, and DNP counts as last place.",
            "Tap a DNP count to see which scouts flagged that team.",
            "Admins can drag teams to fine-tune the final order.",
          ],
        },
        {
          heading: "Selection (alliance selection day)",
          items: [
            "Everyone sees the same live board, so picks show up on every phone as they happen.",
            "An admin taps Start alliance selection to load the Team List order.",
            "As teams get chosen on the field, admins tap Picked. The team drops into the Picked section and the rest renumber. Tap Undo if it was a mistake.",
            "Once you know your partners, admins drag teams to reorder who you want next. Picked teams aren't affected.",
            "Tap ⇄ on two teams, then Compare to see them side by side.",
            "Reload pulls the Team List order back in. You can keep the picks or start over.",
          ],
        },
        {
          heading: "Helpful tools",
          items: [
            "Compare puts several teams' stats side by side.",
            "Rank Game shows you two robots at a time and asks which should rank higher, then suggests a new order for the range you choose. You can Apply or Discard the result.",
          ],
        },
      ],
    },
  },
  {
    matchPrefix: "/alliance-builder",
    guide: {
      id: "alliance-builder",
      title: "Alliances",
      intro: "Track alliance selection live as it happens on the field.",
      sections: [
        {
          heading: "Using the board",
          items: [
            "Each alliance has a Captain, Pick 1 and Pick 2. Tap a slot to choose a team.",
            "Teams already placed on another alliance are left out of the list.",
            "Each alliance's combined OPR, EPA and estimated balls (~Balls) update as you fill it in.",
            "Only admins can edit. Everyone else sees the board update live.",
            "Admins can use Clear Board to start over.",
          ],
        },
      ],
    },
  },
  {
    matchPrefix: "/admin",
    guide: {
      id: "admin",
      title: "Admin",
      intro: "Set up the event and manage scouts. Use the tabs across the top to switch areas.",
      sections: [
        {
          heading: "Event",
          items: [
            "Add an event by its TBA key (for example 2026wasno), then make it Active. Everyone in the app sees the active event.",
            "Set My Team Number so our matches are highlighted.",
            "Auto Sync turns automatic TBA and Statbotics updates on or off.",
            "Create Mock Competition builds a fake event for practice and testing.",
          ],
        },
        {
          heading: "Users",
          items: [
            "Set each person's role. Scouts scout, analysts get the data pages, and admins can do everything.",
            "Reset PW gives you a code, valid for 24 hours, that the user enters under Have a reset code? on the login screen.",
            "Bot accounts fill scouting slots when you don't have enough people.",
          ],
        },
        {
          heading: "Assignments",
          items: [
            "Mark which scouts are available for which matches, then Auto-Generate assignments in shifts.",
            "Reassign Scout swaps one scout's matches to someone else. The Coverage Summary shows any gaps.",
          ],
        },
        {
          heading: "Config, Raw Data, Export, Scouts",
          items: [
            "Config: choose which scouting form (fields and sections) is active.",
            "Raw Data: view or delete individual scouting entries.",
            "Export: download stats, match entries or pit entries as CSV.",
            "Scouts: shows how consistent each scout is compared with others who scouted the same team. Lower deviation is better.",
          ],
        },
      ],
    },
  },
];

export function getGuideForPath(pathname: string): PageGuide | null {
  return guides.find((g) => pathname.startsWith(g.matchPrefix))?.guide ?? null;
}
