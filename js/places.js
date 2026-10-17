// Real places within a short drive of home, researched October 2026.
// Coordinates from OpenStreetMap (Nominatim) and postcodes.io. Things change, so
// every popup links to Google Maps for current hours. "isNew" = opened recently.

// Deliberately approximate (the site is public): roughly Milton, not the house.
export const HOME = { ll: [51.633, -1.305], label: "Home-ish" };

export const CATS = {
  food: { label: "Food", emoji: "🍽️" },
  pub: { label: "Pubs", emoji: "🍺" },
  drinks: { label: "Drinks", emoji: "🍸" },
  music: { label: "Music", emoji: "🎶" },
  stage: { label: "Stage & screen", emoji: "🎭" },
  culture: { label: "Culture", emoji: "🏛️" },
  outdoors: { label: "Outdoors", emoji: "🌳" },
  active: { label: "Active", emoji: "🧗" },
  events: { label: "Events", emoji: "🎟️" },
};

export const PLACES = [
  { id: "day-release", n: "Day Release (Tap Social)", cat: "food", town: "Milton Park", tags: ["dinner", "new", "cheap", "drinks", "brunch"], isNew: true, ll: [51.62142, -1.29906],
    b: "Tap Social's biggest venue yet, opened summer 2026 a few minutes from home. Sourdough pizza, ten beers on tap, and a Brew School where you can brew your own." },
  { id: "arbequina", n: "Arbequina", cat: "food", town: "Oxford", tags: ["dinner", "new", "world"], isNew: true, ll: [51.75273, -1.25672],
    b: "Oxford's much-loved tapas bar, now in a new home in the Covered Market. Order too much and share everything." },
  { id: "corn-room", n: "The Corn Room", cat: "food", town: "Witney", tags: ["dinner", "new", "treat"], isNew: true, ll: [51.78442, -1.49159],
    b: "A new bistro on Corn Street that opened in 2026 and has already made the Michelin Guide." },
  { id: "yeti", n: "Yeti", cat: "food", town: "Oxford", tags: ["dinner", "new", "world"], isNew: true, ll: [51.74571, -1.23075],
    b: "Nepalese cooking near the top of Oxford's new-restaurant ratings. Momos first, curry second." },
  { id: "babylon", n: "Babylon House of Shawarma", cat: "food", town: "Headington", tags: ["dinner", "new", "world", "cheap"], isNew: true, ll: [51.7605, -1.21067],
    b: "A newer Middle Eastern grill in Headington: shawarma, mezze and big portions." },
  { id: "lulas", n: "Lula's Ethiopian", cat: "food", town: "Oxford", tags: ["dinner", "new", "world", "cheap"], isNew: true, ll: [51.75293, -1.26555],
    b: "Ethiopian sharing platters on injera, eaten with your hands. Perfect for a cuisine you've never tried." },
  { id: "chez-mal", n: "Chez Mal at Malmaison", cat: "food", town: "Oxford", tags: ["dinner", "treat", "romantic", "drinks"], ll: [51.75148, -1.26257],
    b: "Dinner and cocktails inside Oxford's old castle prison. Yes, the rooms used to be cells." },
  { id: "spiced-roots", n: "Spiced Roots", cat: "food", town: "Oxford", tags: ["dinner", "world", "drinks"], ll: [51.74892, -1.24118],
    b: "Caribbean cooking and a serious rum list on Cowley Road. Get the curry goat and a rum cocktail." },
  { id: "coconut-tree", n: "The Coconut Tree", cat: "food", town: "Oxford", tags: ["dinner", "world", "cheap", "drinks"], ll: [51.75102, -1.23875],
    b: "Sri Lankan street-food small plates (hoppers, kottu) and inventive cocktails in St Clement's." },
  { id: "olis-thai", n: "Oli's Thai", cat: "food", town: "Oxford", tags: ["dinner", "world"], ll: [51.74256, -1.23487],
    b: "Tiny, legendary Thai spot on Magdalen Road. Book well ahead, it's worth it." },
  { id: "gees", n: "Gee's", cat: "food", town: "Oxford", tags: ["dinner", "treat", "romantic"], ll: [51.7643, -1.2612],
    b: "Dinner in a Victorian glasshouse on Banbury Road. Mediterranean menu, peak romance." },
  { id: "pierre-victoire", n: "Pierre Victoire", cat: "food", town: "Oxford", tags: ["dinner", "romantic"], ll: [51.75864, -1.26181],
    b: "Cosy French bistro on Little Clarendon Street. Candles, fondue, that kind of night." },
  { id: "edamame", n: "Edamamé", cat: "food", town: "Oxford", tags: ["dinner", "world", "cheap"], ll: [51.755, -1.25107],
    b: "Small, much-loved Japanese restaurant on Holywell Street. Simple, warm, delicious." },
  { id: "zheng", n: "Zheng", cat: "food", town: "Oxford", tags: ["dinner", "world"], ll: [51.76143, -1.26812],
    b: "Malaysian and Chinese cooking in Jericho: rendang, nasi lemak and noodles." },
  { id: "pizza-club", n: "Oxford Pizza Club", cat: "food", town: "Oxford", tags: ["dinner", "cheap"], ll: [51.75846, -1.26816],
    b: "Cosy Jericho pizza café with creative toppings and Basque cheesecake." },
  { id: "the-folly", n: "The Folly", cat: "food", town: "Oxford", tags: ["dinner", "treat", "romantic", "afternoon-tea"], ll: [51.74619, -1.2565],
    b: "Riverside dining right on Folly Bridge. Ask for a table by the water." },
  { id: "dishoom", n: "Dishoom", cat: "food", town: "Oxford", tags: ["dinner", "world", "brunch"], ll: [51.75207, -1.25983],
    b: "Bombay café comfort food. A buzzy dinner, or a bacon naan brunch." },
  { id: "aromi", n: "Aromi", cat: "food", town: "Oxford", tags: ["dinner", "new", "cheap", "brunch"], isNew: true, ll: [51.75345, -1.25898],
    b: "Sicilian bakery and pizzeria, new on St Michael's Street. Take cannoli for the walk home." },
  { id: "cherwell-boathouse", n: "Cherwell Boathouse", cat: "food", town: "Oxford", tags: ["dinner", "treat", "romantic", "punt"], ll: [51.76965, -1.25377],
    b: "Punt hire and a well-loved riverside restaurant in one. Punt first, then dinner." },
  { id: "le-manoir", n: "Le Manoir aux Quat'Saisons", cat: "food", town: "Great Milton", tags: ["treat", "cooking", "afternoon-tea"], ll: [51.71614, -1.09198],
    b: "Raymond Blanc's famous restaurant, gardens and cookery school. The once-in-a-while treat." },
  { id: "magdalen-arms", n: "The Magdalen Arms", cat: "pub", town: "Oxford", tags: ["pub", "dinner"], ll: [51.74127, -1.23674],
    b: "One of Oxford's best gastropubs: big sharing pies, proper cooking and a lively room." },
  { id: "the-perch", n: "The Perch", cat: "pub", town: "Binsey", tags: ["pub", "walk"], ll: [51.76575, -1.28732],
    b: "Thatched pub in Binsey, a lovely walk across Port Meadow from Jericho." },
  { id: "the-trout", n: "The Trout Inn", cat: "pub", town: "Wolvercote", tags: ["pub"], ll: [51.78005, -1.29915],
    b: "Riverside pub by the Godstow Nunnery ruins, famous from Inspector Morse." },
  { id: "white-hart-fyfield", n: "The White Hart", cat: "pub", town: "Fyfield", tags: ["pub", "dinner", "treat"], ll: [51.68605, -1.38875],
    b: "A 15th-century hall turned award-winning gastropub, with a big reputation for local produce." },
  { id: "bear-north-moreton", n: "The Bear at Home", cat: "pub", town: "North Moreton", tags: ["pub", "dinner"], ll: [51.5998, -1.19056],
    b: "16th-century village gastropub near Didcot, highly rated for its food." },
  { id: "chequers-burcot", n: "The Chequers", cat: "pub", town: "Burcot", tags: ["pub", "dinner"], ll: [51.65983, -1.18699],
    b: "Village pub near the Thames with an open fire and well-reviewed food." },
  { id: "seven-stars", n: "The Seven Stars", cat: "pub", town: "Marsh Baldon", tags: ["pub", "dinner"], ll: [51.68916, -1.1874],
    b: "Community-owned village pub on Marsh Baldon's enormous green." },
  { id: "barley-mow", n: "The Barley Mow", cat: "pub", town: "Clifton Hampden", tags: ["pub", "walk"], ll: [51.65366, -1.20888],
    b: "Thatched pub by Clifton Hampden bridge. Walk the Thames path first." },
  { id: "five-little-pigs", n: "Five Little Pigs", cat: "food", town: "Wallingford", tags: ["dinner"], ll: [51.59806, -1.12476],
    b: "Neighbourhood bistro in Wallingford, born from a community crowdfunder." },
  { id: "nut-tree", n: "The Nut Tree Inn", cat: "pub", town: "Murcott", tags: ["pub", "treat", "dinner"], ll: [51.83619, -1.14996],
    b: "Thatched village pub with seriously acclaimed cooking. Book well ahead." },
  { id: "broad-face", n: "The Broad Face", cat: "pub", town: "Abingdon", tags: ["pub", "drinks"], ll: [51.66935, -1.28011],
    b: "Riverside pub by Abingdon Bridge, close to home." },
  { id: "turf", n: "Turf Tavern", cat: "drinks", town: "Oxford", tags: ["drinks"], ll: [51.75469, -1.25286],
    b: "A hidden medieval pub down a twisting alley, with braziers in the yard." },
  { id: "tap-social-botley", n: "Tap Social", cat: "drinks", town: "Botley", tags: ["drinks", "jazz"], ll: [51.75129, -1.29526],
    b: "Brewery taproom in Botley, and the current home of The Spin jazz club nights." },
  { id: "varsity-club", n: "The Varsity Club", cat: "drinks", town: "Oxford", tags: ["drinks", "viewpoint"], ll: [51.75239, -1.25702],
    b: "Cocktails on a rooftop terrace looking out over the spires." },
  { id: "o2-academy", n: "O2 Academy", cat: "music", town: "Oxford", tags: ["gig"], ll: [51.7469, -1.23451],
    b: "Oxford's biggest gig venue on Cowley Road, with a smaller second room for newer bands." },
  { id: "jericho-tavern", n: "Jericho Tavern", cat: "music", town: "Oxford", tags: ["gig", "comedy"], ll: [51.76014, -1.26653],
    b: "The pub where Radiohead and Supergrass played early gigs. Also home to the Oxford Imps improv nights." },
  { id: "bullingdon", n: "The Bullingdon", cat: "music", town: "Oxford", tags: ["gig"], ll: [51.74739, -1.23594],
    b: "Cowley Road club and gig venue for bands, DJs and late nights." },
  { id: "holywell", n: "Holywell Music Room", cat: "music", town: "Oxford", tags: ["classical", "jazz"], ll: [51.75528, -1.25323],
    b: "Built in 1748, it's said to be Europe's oldest purpose-built concert room. Chamber music and jazz." },
  { id: "sheldonian", n: "Sheldonian Theatre", cat: "music", town: "Oxford", tags: ["classical"], ll: [51.75432, -1.25502],
    b: "Christopher Wren's grand hall. Hear an orchestra under its painted ceiling." },
  { id: "truck-oxford", n: "Truck Store", cat: "music", town: "Oxford", tags: ["records", "gig"], ll: [51.74842, -1.23836],
    b: "Independent record shop on Cowley Road, with in-store gigs and album launches." },
  { id: "truck-witney", n: "Truck Witney", cat: "music", town: "Witney", tags: ["records"], ll: [51.7848, -1.48392],
    b: "Oxfordshire's longest-running indie record shop (formerly Rapture), with a whole floor of second-hand vinyl." },
  { id: "cornerstone", n: "Cornerstone Arts Centre", cat: "stage", town: "Didcot", tags: ["theatre", "comedy", "gig"], ll: [51.60684, -1.24049],
    b: "Didcot's arts centre for theatre, comedy and gigs, just down the road." },
  { id: "playhouse", n: "Oxford Playhouse", cat: "stage", town: "Oxford", tags: ["theatre"], ll: [51.75477, -1.26083],
    b: "Oxford's main theatre for touring plays, dance and comedy." },
  { id: "new-theatre", n: "New Theatre", cat: "stage", town: "Oxford", tags: ["theatre"], ll: [51.75386, -1.25984],
    b: "Big touring musicals and shows on George Street." },
  { id: "old-fire-station", n: "Old Fire Station", cat: "stage", town: "Oxford", tags: ["fringe", "comedy"], ll: [51.75372, -1.26221],
    b: "Arts centre with fringe theatre, comedy and a free gallery." },
  { id: "north-wall", n: "The North Wall", cat: "stage", town: "Summertown", tags: ["fringe", "theatre"], ll: [51.77769, -1.2687],
    b: "Summertown arts centre for new writing, music and small-scale theatre." },
  { id: "pegasus", n: "Pegasus Theatre", cat: "stage", town: "Oxford", tags: ["fringe"], ll: [51.74148, -1.23634],
    b: "East Oxford theatre for new work, dance and adventurous shows." },
  { id: "unicorn", n: "Unicorn Theatre", cat: "stage", town: "Abingdon", tags: ["fringe", "theatre"], ll: [51.66965, -1.27921],
    b: "A tiny theatre inside Abingdon's medieval abbey buildings." },
  { id: "corn-exchange-wallingford", n: "Corn Exchange", cat: "stage", town: "Wallingford", tags: ["cinema", "theatre"], ll: [51.59984, -1.12424],
    b: "Wallingford's theatre and cinema in an old corn exchange. Films most nights, plus live shows." },
  { id: "kenton", n: "Kenton Theatre", cat: "stage", town: "Henley-on-Thames", tags: ["theatre"], ll: [51.53944, -0.90334],
    b: "Opened in 1805, one of England's oldest working theatres." },
  { id: "upp", n: "Ultimate Picture Palace", cat: "stage", town: "Oxford", tags: ["cinema"], ll: [51.74879, -1.23924],
    b: "Oxford's oldest cinema (1911), an independent single screen on Jeune Street." },
  { id: "phoenix", n: "Phoenix Picturehouse", cat: "stage", town: "Oxford", tags: ["cinema"], ll: [51.76024, -1.26677],
    b: "Jericho's Picturehouse cinema, with a bar upstairs." },
  { id: "cineworld-didcot", n: "Cineworld", cat: "stage", town: "Didcot", tags: ["cinema"], ll: [51.6074, -1.24044],
    b: "Big-screen blockbusters, just down the road." },
  { id: "ashmolean", n: "Ashmolean Museum", cat: "culture", town: "Oxford", tags: ["museum"], ll: [51.7555, -1.26026],
    b: "Britain's first public museum, and free to enter. Check for its LiveFriday late openings." },
  { id: "pitt-rivers", n: "Pitt Rivers Museum", cat: "culture", town: "Oxford", tags: ["museum"], ll: [51.75876, -1.25506],
    b: "A wonderfully crammed anthropology museum, through the back of the Natural History Museum. Free." },
  { id: "modern-art", n: "Modern Art Oxford", cat: "culture", town: "Oxford", tags: ["museum"], ll: [51.75096, -1.25908],
    b: "Free contemporary art gallery near the Westgate." },
  { id: "blackwells", n: "Blackwell's", cat: "culture", town: "Oxford", tags: ["bookshop"], ll: [51.75423, -1.25636],
    b: "Legendary Broad Street bookshop, with a vast underground room in the main shop." },
  { id: "mostly-books", n: "Mostly Books", cat: "culture", town: "Abingdon", tags: ["bookshop"], ll: [51.67136, -1.28162],
    b: "Independent bookshop in Abingdon, with great staff picks." },
  { id: "thirsty-meeples", n: "Thirsty Meeples", cat: "culture", town: "Oxford", tags: ["games"], ll: [51.75436, -1.26189],
    b: "Board game café with a library of over 1,000 games, plus cakes and cocktails." },
  { id: "covered-market", n: "Covered Market", cat: "culture", town: "Oxford", tags: ["market"], ll: [51.75273, -1.25672],
    b: "Oxford's historic Covered Market. Browse, graze, and buy ingredients for a cook-off." },
  { id: "didcot-railway", n: "Didcot Railway Centre", cat: "culture", town: "Didcot", tags: ["heritage"], ll: [51.61435, -1.24519],
    b: "Steam engines and heritage trains, minutes from home." },
  { id: "blenheim", n: "Blenheim Palace", cat: "outdoors", town: "Woodstock", tags: ["castle", "walk"], ll: [51.84194, -1.36263],
    b: "A palace, a lake and huge parkland near Woodstock. A proper day out." },
  { id: "dorchester-abbey", n: "Dorchester Abbey", cat: "outdoors", town: "Dorchester-on-Thames", tags: ["castle", "walk"], ll: [51.64361, -1.16419],
    b: "A medieval abbey in a beautiful Thames village. Pair it with tea and a riverside walk." },
  { id: "wallingford-castle", n: "Wallingford Castle Gardens", cat: "outdoors", town: "Wallingford", tags: ["castle", "walk", "picnic"], ll: [51.60233, -1.12294],
    b: "Free-to-wander ruins and gardens of a once-mighty castle." },
  { id: "greys-court", n: "Greys Court", cat: "outdoors", town: "Henley-on-Thames", tags: ["castle", "walk"], ll: [51.54492, -0.95576],
    b: "National Trust house and walled gardens near Henley." },
  { id: "basildon-park", n: "Basildon Park", cat: "outdoors", town: "Lower Basildon", tags: ["castle", "walk"], ll: [51.49908, -1.12143],
    b: "Grand National Trust house and parkland above the Thames." },
  { id: "harcourt", n: "Harcourt Arboretum", cat: "outdoors", town: "Nuneham Courtenay", tags: ["walk", "picnic"], ll: [51.68189, -1.20105],
    b: "Oxford's arboretum, glorious in autumn colour." },
  { id: "wittenham-clumps", n: "Wittenham Clumps", cat: "outdoors", town: "Little Wittenham", tags: ["viewpoint", "walk", "dark-sky", "picnic"], ll: [51.62933, -1.18124],
    b: "Two tree-topped hills above the Thames, close to home. The best sunset spot around." },
  { id: "white-horse-hill", n: "White Horse Hill", cat: "outdoors", town: "Uffington", tags: ["viewpoint", "walk", "dark-sky"], ll: [51.57774, -1.56656],
    b: "A 3,000-year-old chalk horse on the Ridgeway, with huge views and dark skies." },
  { id: "port-meadow", n: "Port Meadow", cat: "outdoors", town: "Oxford", tags: ["viewpoint", "walk", "picnic"], ll: [51.77148, -1.28445],
    b: "A vast open meadow by the Thames, with grazing horses, big sunsets and a walk to The Perch." },
  { id: "abbey-meadows", n: "Abbey Meadows", cat: "outdoors", town: "Abingdon", tags: ["picnic", "walk"], ll: [51.67073, -1.27384],
    b: "Riverside park in Abingdon by the Thames, made for a picnic." },
  { id: "shotover", n: "Shotover Country Park", cat: "outdoors", town: "Oxford", tags: ["walk"], ll: [51.74548, -1.17426],
    b: "Woodland and heath on Oxford's eastern edge. Good for a muddy walk." },
  { id: "didcot-parkway", n: "Didcot Parkway", cat: "outdoors", town: "Didcot", tags: ["train"], ll: [51.61122, -1.24252],
    b: "Your station for a 'Third Stop Off' adventure, with trains towards Oxford, Reading, Swindon and beyond." },
  { id: "brookes-climb", n: "Oxford Brookes Climbing Centre", cat: "active", town: "Headington", tags: ["climb"], ll: [51.75439, -1.22318],
    b: "Climbing and bouldering centre that's open to the public, with beginner sessions." },
  { id: "hinksey-pool", n: "Hinksey Outdoor Pool", cat: "active", town: "Oxford", tags: ["swim"], ll: [51.73996, -1.25677],
    b: "A heated outdoor pool in south Oxford (summer season). Check opening dates first." },
  { id: "ice-rink", n: "Oxford Ice Rink", cat: "active", town: "Oxford", tags: ["skate"], ll: [51.74863, -1.26518],
    b: "Public skating sessions. Hold hands, for balance." },
  { id: "magdalen-boathouse", n: "Magdalen Bridge Boathouse", cat: "active", town: "Oxford", tags: ["punt"], ll: [51.75087, -1.24564],
    b: "Punt hire under Magdalen Bridge (seasonal)." },
];

// Somewhere to eat on a date: not a coffee or burger chain if there's anywhere else
// (other chains are fine, just not first choice), and not somewhere you can't go in.
export const BIG_CHAIN = /^(costa|starbucks|caff[eè] nero|cafe nero|pret\b|greggs|mcdonald|kfc|burger king|subway|domino|pizza hut|papa john|five guys|leon\b|itsu|wasabi|tim hortons|krispy|harvester|toby carvery|beefeater|brewers fayre|hungry horse|frankie|chiquito|tgi|wetherspoon|j ?d wetherspoon|bella italia|prezzo|zizzi|ask italian|pizza ?express|nando|las iguanas|caffe concerto|black sheep coffee|joe (and|&) the juice|esquires|coffee ?#?1|muffin break|cafe rouge|wildwood|miller (and|&) carter|sizzling pub|ember inn|vintage inn|chef (and|&) brewer|stonehouse)/i;
export const NOT_PUBLIC = /\bmembers\b|\bstaff\b|\bprivate\b|canteen|cafeteria|refectory|hospital|university|college|school|\boffice\b|\bwards?\b/i;
const NOT_A_DATE = /sports (bar|cafe|pub)|hot chicken|fried chicken|chicken shop|kebab|\bwings\b|shisha|\bcasino\b|betting|carvery|\bservices\b/i;
export const chainPenalty = (p) => (BIG_CHAIN.test(p.n || "") ? 4 : p.chain ? 1.5 : 0) + (NOT_A_DATE.test(p.n || "") ? 2.5 : 0);

export function km([a, b], [c, d]) {
  const r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

// A rough travel time from wherever Theo is looking: walking if it's close, else
// driving (road ≈ 1.3× straight line at ~45km/h, plus parking, plus central Oxford
// traffic). Rounded to 5 minutes.
// Nobody drives across London: walk if it's close, otherwise Tube or bus (about 12
// minutes to get to the station and wait, then ~23 km/h).
export const inLondon = ([lat, lon]) => lat > 51.28 && lat < 51.7 && lon > -0.52 && lon < 0.34;
export function travel(ll, from = HOME.ll) {
  const d = km(from, ll);
  const round5 = (m) => Math.max(5, Math.round(m / 5) * 5);
  if (d < 1.6) return { mode: "walk", mins: round5((d * 1.3 * 60) / 4.8) };
  if (inLondon(from) && inLondon(ll)) return { mode: "transit", mins: round5(12 + d * 1.3 * 2.6) };
  const inOxford = ll[0] > 51.735 && ll[0] < 51.785 && ll[1] > -1.29 && ll[1] < -1.2;
  return { mode: "drive", mins: round5((d * 1.3 * 60) / 45 + 4 + (inOxford ? 8 : 0)) };
}

const MODE_WORD = { walk: "walk", drive: "drive", transit: "by Tube/bus" };
export const MODE_EMOJI = { walk: "🚶", drive: "🚗", transit: "🚇" };
export const travelLabel = (ll, from) => {
  const t = travel(ll, from);
  return `~${t.mins} min ${MODE_WORD[t.mode] || t.mode}`;
};

// Live places search by name centred on their exact spot (town names aren't always known).
export const mapsSearch = (p) => p.osm
  ? `https://www.google.com/maps/search/${encodeURIComponent(p.n)}/@${p.ll[0]},${p.ll[1]},17z`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.n}, ${p.town}`)}`;
// Live (OpenStreetMap) places route to exact coordinates; hand-picked ones by name.
export const mapsDirections = (p) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.osm ? p.ll.join(",") : `${p.n}, ${p.town}`)}`;
