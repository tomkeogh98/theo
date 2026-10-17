// Time of year. Two jobs:
//   1. seasonal dates that only make sense now (Christmas markets, bonfire night,
//      bluebells, pick-your-own…), each with a live "what's on near you" search
//   2. seasonal nudges for every other idea (cosy nights in when it's dark at 4pm,
//      fewer sea swims in January, more stargazing on long nights)
// Dates are [month, day] ranges, inclusive; ranges can wrap the new year.

const inRange = (now, [[m1, d1], [m2, d2]]) => {
  const v = (now.getMonth() + 1) * 100 + now.getDate();
  const a = m1 * 100 + d1, b = m2 * 100 + d2;
  return a <= b ? v >= a && v <= b : v >= a || v <= b;
};

// Each becomes a normal idea (same shape as ideas.js), plus `when` (date range),
// `search` (what to look up locally) and `hook` (the line shown on the card).
const SEASONAL = [
  {
    id: "s-christmas-market", e: "🎄", t: "Christmas Market Wander", when: [[11, 15], [12, 23]], search: "christmas market",
    b: "Mulled wine in mittens, a wander through the stalls, and one silly bauble each to remember the year by.",
    s: ["Find the nearest Christmas market (Theo's search below helps).", "Each pick one bauble for the tree that sums up your year.", "Finish with something hot and spiced, and a mince pie."],
    q: "What's your favourite Christmas memory from when you were little?",
    v: ["cosy", "food", "culture"], w: "out", time: 2, cost: 1, i: ["eating-out", "cosy", "drinks"], hook: "🎄 It's Christmas market season", at: [[11, 19.5]],
  },
  {
    id: "s-ice-rink", e: "⛸️", t: "Ice Rink & Hot Chocolate", when: [[11, 15], [1, 10]], search: "ice rink", go: ["skate"],
    b: "A pop-up rink under fairy lights, a lot of hand-holding (for balance, obviously), then hot chocolate with everything on top.",
    s: ["Book a skating slot at the nearest pop-up or permanent rink.", "Hold hands the whole time. It's a safety thing.", "Hot chocolate after, and rate each other's wobbles."],
    q: "When did you last feel like a kid?",
    v: ["active", "cosy"], w: "venue", time: 1, cost: 1, i: ["exercise", "games", "cosy"], hook: "⛸️ Skating season", at: [[11, 20.5]],
  },
  {
    id: "s-lights-trail", e: "✨", t: "Christmas Lights Trail", when: [[11, 20], [1, 3]], search: "christmas lights trail",
    b: "An illuminated trail through gardens or woods after dark: glowing tunnels, fire pits and a toasted marshmallow.",
    s: ["Look up a lights trail nearby and book a time slot.", "Wrap up warm and take the good camera, Tom.", "Toast marshmallows at the fire pits and walk it slowly."],
    q: "What's the most magical place you've ever been?",
    v: ["cosy", "adventure", "creative"], w: "outdoor", time: 2, cost: 2, i: ["photography", "nature", "cosy"], hook: "✨ Lights trails are on", at: [[16, 20]], dark: true,
  },
  {
    id: "s-carols", e: "🕯️", t: "Carols by Candlelight", when: [[12, 1], [12, 23]], search: "carol concert candlelight",
    b: "A candlelit carol service or concert in an old church. Even the non-singers get goosebumps.",
    s: ["Find a carol concert or service nearby (churches and cathedrals often list them).", "Arrive early for a good pew and sing along, badly.", "Mince pies and mulled wine after."],
    q: "Which song always makes you feel festive?",
    v: ["music", "cosy", "culture"], w: "venue", time: 1, cost: 0, i: ["live-music", "cosy"], hook: "🕯️ Carol season", at: [[17, 19.75]],
  },
  {
    id: "s-panto", e: "🤡", t: "Panto Night", when: [[12, 1], [1, 12]], search: "pantomime", go: ["theatre"],
    b: "Oh yes it is. Boo the villain, cheer the dame, and shout 'he's behind you!' with complete commitment.",
    s: ["Book the nearest panto (most theatres run one).", "Agree a team shout-out rule: every 'he's behind you' must be loud.", "Debrief over chips: best costume, worst joke."],
    q: "What were family Christmases like for you growing up?",
    v: ["culture", "cosy"], w: "venue", time: 2, cost: 1, i: ["theatre", "comedy"], hook: "🤡 It's panto season", at: [[13, 19]], book: true,
  },
  {
    id: "s-christmas-films", e: "🎅", t: "Christmas Film & Mulled Wine Night", when: [[12, 1], [12, 30]],
    b: "Your favourite Christmas film each, a pan of mulled wine, and the tree lights on. Absolute non-negotiable of the season.",
    s: ["Each pick a Christmas film the other hasn't seen in years.", "Make mulled wine (or cider) on the hob with orange and cloves.", "Fairy lights on, phones off, blanket shared."],
    q: "Which Christmas film is non-negotiable for you, and why?",
    v: ["cosy", "culture", "food"], w: "in", time: 2, cost: 0, i: ["movies", "cosy", "cooking"], hook: "🎅 'Tis the season", at: [[15, 22]],
  },
  {
    id: "s-wreath", e: "💐", t: "Make a Christmas Wreath", when: [[11, 20], [12, 20]], search: "wreath making workshop",
    b: "Forage some greenery (or buy a kit), put on a Christmas playlist, and make a wreath together for the front door.",
    s: ["Gather greenery on a walk, or pick up a wreath kit.", "Cat leads the design, Tom does the wiring, and you both argue about ribbon.", "Hang it up and take a photo for next year's scrapbook."],
    q: "What's one tradition you'd love us to start this Christmas?",
    v: ["creative", "cosy"], w: "in", time: 2, cost: 1, i: ["embroidery", "art", "cosy"], hook: "💐 Wreath season", at: [[10, 20]],
  },
  {
    id: "s-nye", e: "🥂", t: "New Year's Eve, Your Way", when: [[12, 29], [12, 31]], search: "new year's eve event",
    b: "Skip the overpriced club: a lovely dinner, a list of the year's best bits, then fireworks somewhere with a view.",
    s: ["Book dinner, or cook something special.", "Each write your top five moments of the year and swap.", "Find a spot with a view of the fireworks at midnight."],
    q: "What do you want more of next year?",
    v: ["cosy", "food"], w: "out", time: 3, cost: 2, i: ["eating-out", "cosy"], hook: "🥂 Year's end", at: [[17, 21]],
  },
  {
    id: "s-bonfire", e: "🎆", t: "Bonfire Night Fireworks", when: [[11, 1], [11, 8]], search: "fireworks display bonfire night",
    b: "A proper fireworks display, a toffee apple, and the smell of bonfire smoke on your coats.",
    s: ["Find the nearest organised display tonight or this weekend.", "Wrap up, take a flask, and get there early for a good spot.", "Sparklers after, and write your initials in the air."],
    q: "What's the most 'oooh' moment you've ever had?",
    v: ["adventure", "cosy"], w: "outdoor", time: 2, cost: 1, i: ["photography", "cosy"], hook: "🎆 Bonfire week", at: [[17, 20]], dark: true,
  },
  {
    id: "s-halloween", e: "🎃", t: "Pumpkin Carving & Horror Double Bill", when: [[10, 18], [10, 31]],
    b: "Carve a pumpkin each (judged by Theo), roast the seeds, then a scary film double bill with the lights off.",
    s: ["Pick up two pumpkins and a carving kit.", "Carve in secret, then do a big reveal by candlelight.", "Horror double bill: one classic, one new. Roasted seeds as popcorn."],
    q: "What scared you most as a kid?",
    v: ["cosy", "creative", "culture"], w: "in", time: 2, cost: 1, i: ["movies", "art", "cosy"], hook: "🎃 Halloween's nearly here", at: [[14, 21.5]],
  },
  {
    id: "s-ghost-walk", e: "👻", t: "Ghost Walk", when: [[10, 15], [11, 10]], search: "ghost walk tour",
    b: "A guided ghost walk through the old streets after dark: gruesome history, creaky alleys, and an excuse to hold hands.",
    s: ["Look up a ghost walk or haunted history tour nearby.", "Wrap up and pick the scariest-looking pub for after.", "Each rate the scariest story out of ten."],
    q: "Do you believe in ghosts, honestly?",
    v: ["culture", "adventure"], w: "out", time: 1, cost: 1, i: ["history", "theatre"], hook: "👻 Spooky season", at: [[18, 20.5]], dark: true,
  },
  {
    id: "s-autumn-colours", e: "🍂", t: "Autumn Colours Walk", when: [[10, 1], [11, 15]], go: ["walk"],
    b: "Woods at their best: kick through the leaves, collect the reddest one each, and find a pub with a fire after.",
    s: ["Pick a woodland, arboretum or park nearby.", "Each find the most beautiful leaf (press it at home).", "Pub with a fire afterwards. Non-negotiable."],
    q: "What's your favourite season, and why?",
    v: ["adventure", "cosy"], w: "outdoor", time: 2, cost: 0, i: ["nature", "photography"], hook: "🍂 Peak autumn colour", at: [[9, 15]], sun: true,
  },
  {
    id: "s-apple-picking", e: "🍎", t: "Apple Picking & Cider", when: [[9, 1], [10, 20]], search: "pick your own apples",
    b: "Pick your own apples at a farm, then a cider tasting (or apple crumble at home).",
    s: ["Find a pick-your-own orchard or farm nearby.", "Fill a bag, and try one of every variety.", "Cider tasting after, or bake a crumble together that evening."],
    q: "What food takes you straight back to childhood?",
    v: ["adventure", "food"], w: "outdoor", time: 2, cost: 1, i: ["cooking", "nature"], hook: "🍎 Harvest time", at: [[9.5, 15]], sun: true,
  },
  {
    id: "s-bluebells", e: "🔵", t: "Bluebell Wood Walk", when: [[4, 15], [5, 20]], search: "bluebell woods", go: ["walk"],
    b: "For a few weeks a year the woods turn blue. Go early, go slow, and stick to the paths.",
    s: ["Look up the nearest bluebell wood (the National Trust lists the best).", "Stick to the paths: bluebells are fragile.", "Picnic or pub lunch after."],
    q: "What's a small thing that always makes you happy?",
    v: ["adventure", "cosy"], w: "outdoor", time: 2, cost: 0, i: ["nature", "photography"], hook: "🔵 Bluebell season", at: [[9, 16]], sun: true,
  },
  {
    id: "s-pyo", e: "🍓", t: "Pick-Your-Own Strawberries", when: [[6, 1], [8, 15]], search: "pick your own strawberries",
    b: "Fill a punnet (eat half on the way round), then make something with the rest: Eton mess or jam.",
    s: ["Find a pick-your-own farm nearby.", "Fill a punnet each, and taste-test as you go.", "Make Eton mess or jam together at home."],
    q: "What's your perfect summer day?",
    v: ["adventure", "food"], w: "outdoor", time: 2, cost: 1, i: ["cooking", "nature"], hook: "🍓 Strawberry season", at: [[9, 16]], sun: true,
  },
  {
    id: "s-sunset-swim", e: "🌅", t: "Sunset Swim", when: [[6, 1], [9, 20]], go: ["swim", "coast"],
    b: "The sea's warmest at the end of the day and the end of the summer. Swim at sunset, then chips on the beach.",
    s: ["Pick a lifeguarded or well-known safe beach and check the tide.", "Swim as the sun goes down (stay close to shore).", "Towels, a flask and chips on the sand after."],
    q: "What's your favourite memory by the sea?",
    v: ["active", "adventure"], w: "outdoor", time: 1, cost: 0, i: ["water", "exercise"], hook: "🌅 Warm-sea season", at: [[17, 21]], golden: true,
  },
  {
    id: "s-midsummer", e: "☀️", t: "Midsummer Sunrise", when: [[6, 15], [6, 26]],
    b: "The shortest night of the year. Stay up (or get up stupidly early) and watch the sun rise with a flask.",
    s: ["Check the sunrise time (it's before 5am!).", "Find a hill or beach facing east.", "Flask, blanket and a pastry each. Back to bed after."],
    q: "What are you hoping the rest of this year brings?",
    v: ["adventure", "cosy"], w: "outdoor", time: 1, cost: 0, i: ["nature", "photography"], hook: "☀️ The longest day", at: [[3.5, 5.5]],
  },
  {
    id: "s-valentines", e: "💘", t: "Valentine's, Done Properly", when: [[2, 9], [2, 14]], search: "valentines dinner",
    b: "Not the set menu: a handwritten card each, somewhere you both love, and one thing you've never done together.",
    s: ["Write each other a proper card, by hand, no rushing.", "Book somewhere that means something to you two.", "Do one new thing together, however small."],
    q: "What's something you love about us that we never say out loud?",
    v: ["cosy", "food"], w: "out", time: 2, cost: 2, i: ["eating-out", "cosy"], hook: "💘 Valentine's week", at: [[17, 21]],
  },
];

// Ideas that only fit the time of year we're in.
export function seasonalIdeas(now = new Date()) {
  return SEASONAL.filter((s) => inRange(now, s.when)).map((s) => ({ ...s, seasonal: true, local: false }));
}

const SEASON = (now) => {
  const m = now.getMonth() + 1;
  return m === 12 || m <= 2 ? "winter" : m <= 5 ? "spring" : m <= 8 ? "summer" : "autumn";
};
export const seasonName = (now = new Date()) => SEASON(now);

// How much the time of year suits an idea (a weight multiplier) and why.
export function seasonFit(idea, now = new Date()) {
  const s = SEASON(now);
  const m = now.getMonth() + 1;
  if (idea.seasonal) return { w: 2.5, hook: idea.hook };
  const has = (re) => re.test(`${idea.id} ${idea.t}`);
  if (s === "winter" || m === 11) {
    if (has(/swim|dip|picnic|hamper|pyo|strawberr|open-air|sunset-swim|paddle|sauna/i)) return { w: 0.35, hook: "" };
    if (idea.w === "in" && idea.v.includes("cosy")) return { w: 1.4, hook: "🧣 Cosy-season pick" };
    if (has(/stargaz|night-photo|lights/i)) return { w: 1.4, hook: "🌌 Long dark nights" };
    if (has(/pub|fireside|lights-out|blanket|spa/i)) return { w: 1.3, hook: "🔥 Peak fire-and-a-pint weather" };
  }
  if (s === "summer") {
    if (has(/swim|dip|picnic|hamper|open-air|chips-with|sunset|golden|paddle|boat/i)) return { w: 1.4, hook: "☀️ Made for summer" };
    if (idea.w === "in" && idea.time >= 2) return { w: 0.8, hook: "" };
  }
  if (s === "autumn" && has(/walk|woodland|forest|leaf|colours|pub/i)) return { w: 1.2, hook: m >= 10 ? "🍂 Autumn's best" : "" };
  if (s === "spring" && has(/walk|picnic|garden|bluebell/i)) return { w: 1.2, hook: "🌱 Spring's here" };
  return { w: 1, hook: "" };
}
