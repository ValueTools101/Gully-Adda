/**
 * Small built-in word lists for Name Place Animal Thing bots.
 * Format per category: "A:word,word|B:word,..." (parsed once at load).
 * Bots only use these; human answers are validated by letter + challenge votes.
 */
const RAW: Record<string, string> = {
  name:
    'A:Amit,Anjali,Arjun,Asha,Aarti,Akbar,Anil|B:Bablu,Bhavna,Bunty,Bharat,Bina,Bobby|C:Chintu,Chetan,Chandni,Charu,Chirag|' +
    'D:Deepak,Divya,Dinesh,Dolly,Dev|E:Ekta,Esha,Eshan,Elvis|F:Farhan,Fatima,Firoz,Faisal|G:Gaurav,Geeta,Golu,Gopal,Gauri|' +
    'H:Harish,Hema,Himesh,Heena|I:Isha,Imran,Indu,Irfan|J:Jaya,Jatin,Jyoti,Javed,Juhi|K:Kavita,Karan,Kishore,Kajal,Kunal|' +
    'L:Lata,Lalit,Laxmi,Lucky|M:Manoj,Meena,Mohan,Monu,Mala|N:Neha,Nikhil,Naina,Nitin|O:Om,Omkar,Ojas|P:Pooja,Pinky,Pankaj,Priya,Pappu|' +
    'Q:Qadir,Qasim|R:Rahul,Rani,Rajesh,Rekha,Ravi|S:Sunita,Suresh,Sonu,Shalini,Sachin|T:Tina,Tarun,Tanvi,Tushar|' +
    'U:Usha,Uday,Umesh,Urmila|V:Vikram,Vidya,Varun,Vimla|W:Waseem,Wahida|X:Xavier|Y:Yash,Yamini,Yogesh|Z:Zoya,Zubin,Zakir',
  place:
    'A:Agra,Ajmer,Amritsar,Assam,Ahmedabad|B:Bhopal,Bihar,Bengaluru,Bareilly,Bhutan|C:Chennai,Chandigarh,Cuttack,China|' +
    'D:Delhi,Darjeeling,Dehradun,Dubai|E:Ernakulam,Egypt,England,Etawah|F:Faridabad,France,Fiji|G:Goa,Guwahati,Gwalior,Gaya|' +
    'H:Hyderabad,Haridwar,Howrah,Himachal|I:Indore,Imphal,Italy,Iran|J:Jaipur,Jammu,Jodhpur,Japan|K:Kolkata,Kanpur,Kochi,Kerala,Kota|' +
    'L:Lucknow,Ladakh,Leh,London|M:Mumbai,Mysuru,Madurai,Manali,Meerut|N:Nagpur,Nashik,Nainital,Nepal|O:Ooty,Odisha,Oman|' +
    'P:Pune,Patna,Panipat,Puri,Paris|Q:Qatar|R:Ranchi,Rajkot,Rishikesh,Russia|S:Shimla,Surat,Srinagar,Sikkim|T:Thane,Tirupati,Tripura,Tokyo|' +
    'U:Udaipur,Ujjain,Ujjain,Uganda|V:Varanasi,Vadodara,Vellore,Vizag|W:Wardha,Wayanad,Warangal|X:Xian|Y:Yamunanagar,Yemen|Z:Zanskar,Zambia',
  animal:
    'A:Ant,Alligator,Antelope,Ape|B:Bear,Buffalo,Bat,Bison|C:Cat,Camel,Cow,Cheetah,Crocodile|D:Dog,Deer,Donkey,Dolphin|' +
    'E:Elephant,Eagle,Emu,Eel|F:Fox,Frog,Fish,Falcon|G:Goat,Giraffe,Gorilla,Gecko|H:Horse,Hippo,Hen,Hyena|I:Iguana,Impala,Ibex|' +
    'J:Jackal,Jaguar,Jellyfish|K:Kangaroo,Koala,Kingfisher,Kiwi|L:Lion,Leopard,Lizard,Llama|M:Monkey,Mongoose,Mouse,Mule|' +
    'N:Nilgai,Nightingale,Newt|O:Owl,Ox,Otter,Octopus|P:Parrot,Peacock,Panda,Pig|Q:Quail|R:Rabbit,Rhino,Rat,Raccoon|' +
    'S:Snake,Sheep,Squirrel,Sparrow|T:Tiger,Tortoise,Turtle,Toad|U:Urial,Unicorn fish|V:Vulture,Viper|W:Wolf,Whale,Walrus,Woodpecker|' +
    'X:Xerus|Y:Yak|Z:Zebra',
  thing:
    'A:Almirah,Apple,Axe,Album|B:Bat,Ball,Bucket,Bottle,Book|C:Chair,Cup,Comb,Cycle|D:Diary,Drum,Desk,Doll|E:Eraser,Envelope,Engine|' +
    'F:Fan,Fork,Flute,Frame|G:Glass,Guitar,Gift,Glue|H:Hammer,Hat,Helmet,Handkerchief|I:Ink,Iron,Igloo|J:Jar,Jug,Jacket,Jhoola|' +
    'K:Kite,Kettle,Key,Knife|L:Lamp,Lock,Lantern,Ladder|M:Mirror,Mat,Matka,Mug|N:Needle,Nail,Notebook,Net|O:Oven,Oar,Orange|' +
    'P:Pen,Pencil,Plate,Pillow,Patang|Q:Quilt,Quill|R:Radio,Rope,Ring,Rubber|S:Spoon,Slipper,Sofa,Scale|T:Table,Tiffin,Torch,Tap|' +
    'U:Umbrella,Utensil|V:Vase,Van,Violin|W:Watch,Wallet,Whistle,Window|X:Xylophone|Y:Yoyo,Yarn|Z:Zip,Zipper',
  food:
    'A:Aloo,Achar,Appam|B:Biryani,Bhel,Bonda,Barfi|C:Chole,Chakli,Chikki|D:Dosa,Dhokla,Dal|E:Egg curry|F:Falooda,Fafda|' +
    'G:Gulab jamun,Golgappa,Gajar halwa|H:Halwa,Handvo|I:Idli,Imarti|J:Jalebi,Jeera rice|K:Khichdi,Kachori,Kulfi|L:Laddoo,Lassi|' +
    'M:Modak,Momos,Matar paneer|N:Naan,Nimbu pani|O:Onion pakoda|P:Poha,Paratha,Pav bhaji|Q:Qorma|R:Rasgulla,Rajma,Rabri|' +
    'S:Samosa,Sambar,Sev puri|T:Thepla,Tikki|U:Upma,Uttapam|V:Vada,Vada pav|W:Wafers|Y:Yakhni|Z:Zarda',
};

function parse(raw: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const chunk of raw.split('|')) {
    const [letter, words] = chunk.split(':');
    if (!letter || !words) continue;
    out[letter] = Array.from(new Set(words.split(',').map((w) => w.trim()).filter(Boolean)));
  }
  return out;
}

export const NPAT_WORDS: Record<string, Record<string, string[]>> = Object.fromEntries(
  Object.entries(RAW).map(([cat, raw]) => [cat, parse(raw)]),
);

export function botWords(category: string, letter: string): string[] {
  return NPAT_WORDS[category.toLowerCase()]?.[letter.toUpperCase()] ?? [];
}
