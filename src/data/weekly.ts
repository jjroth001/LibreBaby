/**
 * A short note for each week of the first year, then each month to age three: what's
 * typical now, what's coming, and an occasional practical tip. Original text written for
 * LibreBaby from widely published guidance (AAP, CDC, WHO). General information only —
 * every baby develops on their own timeline; ages here are typical, not deadlines.
 */

export type AgeNote = { title: string; body: string; tip?: string };

/** Index = completed weeks (0 = the first week). */
export const WEEKS: AgeNote[] = [
  {
    title: 'Hello, world',
    body: 'Newborns sleep most of the day and night, in short stretches of a couple of hours. They see best at about 8 to 12 inches, roughly the distance to your face during a feed, so your face is the most interesting thing around.',
    tip: 'Every sleep: on their back, on a firm, flat surface, with nothing else in the crib or bassinet.',
  },
  {
    title: 'Getting to know each other',
    body: 'It’s normal for babies to lose some weight in the first days and regain it by around two weeks. Frequent feeds — often 8 to 12 a day — are how they do it. The umbilical cord stump usually falls off on its own within one to three weeks.',
  },
  {
    title: 'A familiar voice',
    body: 'Your baby could hear you before birth and already prefers your voice to a stranger’s. Many babies hit a growth spurt around two to three weeks and suddenly want to feed much more often for a day or two — that’s expected.',
  },
  {
    title: 'Built-in reflexes',
    body: 'Startling with arms flung out (the Moro reflex), turning toward a touch on the cheek (rooting), and gripping your finger are automatic reflexes. They’re signs of a healthy nervous system and fade over the coming months as voluntary movement takes over.',
  },
  {
    title: 'One month',
    body: 'Neck and shoulder muscles are getting stronger. Short sessions of tummy time while awake and watched — a few minutes, several times a day — help build them, and lying on your chest counts.',
    tip: 'If your baby fusses on the floor, try tummy time across your lap or chest instead.',
  },
  {
    title: 'The fussy weeks',
    body: 'Crying commonly increases over these weeks, often peaking around six weeks and easing by three to four months. Long bouts that nothing seems to fix are a normal phase for many babies, though exhausting for everyone.',
    tip: 'If you’re overwhelmed, it’s okay to put your baby down somewhere safe, like the crib, and take a few minutes for yourself.',
  },
  {
    title: 'The first real smile',
    body: 'Somewhere around six to eight weeks, many babies start smiling at you on purpose — a social smile, not a reflex. It’s one of the first signs of two-way communication.',
    tip: 'Check in on how you’re doing, too: sleep, mood and recovery matter. Tell your own doctor if you’re struggling.',
  },
  {
    title: 'Eyes that follow',
    body: 'Your baby is getting better at following a moving face or toy with their eyes. Bold, high-contrast patterns and faces hold their attention best; finer detail and color vision are still developing.',
  },
  {
    title: 'Discovering hands',
    body: 'Babies around this age often stare at their own hands, bring them together and swipe at toys. Day-night rhythms are starting to form, so longer night stretches may begin to appear for some babies.',
  },
  {
    title: 'Two months',
    body: 'Cooing — soft vowel sounds like “ooh” and “aah” — often starts around now, along with more smiles. Many babies have a check-up with vaccines around two months.',
    tip: 'The first milestone checklist (by 2 months) is in Development.',
  },
  {
    title: 'Little conversations',
    body: 'When your baby coos, answer — then pause and give them a turn. This back-and-forth “serve and return” is one of the most powerful things for early language and brain development.',
  },
  {
    title: 'Stronger every day',
    body: 'Head control is improving, and on their tummy many babies push up on their forearms for a look around. Extra drool is common around now as the salivary glands get busier — it isn’t necessarily teething.',
  },
  {
    title: 'Everything goes in the mouth',
    body: 'Hands meet in the middle, toys get grabbed and everything heads to the mouth. Mouthing is how babies explore texture and shape — the reason to keep small objects well out of reach from now on.',
  },
  {
    title: 'Three months',
    body: 'The startle reflex is fading and movements look smoother and more deliberate. Many babies are more alert and engaged for longer stretches between sleeps.',
  },
  {
    title: 'The first chuckles',
    body: 'Laughter often appears around three to four months. Some babies start rolling from tummy to back soon, sometimes without warning.',
    tip: 'Never leave your baby alone on a bed, sofa or changing table, even for a moment.',
  },
  {
    title: 'A more colorful world',
    body: 'By about four months, babies see a much wider range of colors and track moving things smoothly. Reaching for what they see is getting more accurate.',
  },
  {
    title: 'Too busy to eat',
    body: 'Babies are now so interested in the world that feeds can turn into looking-around sessions. A quieter, dimmer room can help with distracted feeding.',
  },
  {
    title: 'Four months',
    body: 'Sleep cycles are maturing to become more adult-like, and some babies wake more at night for a few weeks — the so-called four-month sleep regression. It usually settles.',
    tip: 'Stop swaddling once your baby shows signs of trying to roll.',
  },
  {
    title: 'Seeing in depth',
    body: 'Depth perception is improving, which makes reaching and grabbing more precise. Rolling both ways is on the way for many babies over the next couple of months.',
  },
  {
    title: 'Raspberries and squeals',
    body: 'Babies experiment with their voices: squeals, growls, blowing raspberries. It’s practice for the mouth movements that speech will need later.',
  },
  {
    title: 'Getting ready for food',
    body: 'Most babies are ready to start solid foods at around six months. Signs of readiness include sitting with support, good head control, interest in your food, and no longer pushing food straight back out with the tongue.',
  },
  {
    title: 'What’s in a name',
    body: 'Babies are starting to recognize familiar words in the stream of speech, and over the coming months many begin turning when they hear their name.',
  },
  {
    title: 'Sitting, with a little help',
    body: 'Many babies can sit propped on their hands or with support now, and they love the view. Back muscles strengthen with every attempt and every topple.',
  },
  {
    title: 'Teeth on the horizon',
    body: 'The first teeth often appear around six months — usually the bottom front ones — though anywhere from a few months to after the first birthday is normal.',
    tip: 'Once a tooth appears, brush twice a day with a rice-grain-sized smear of fluoride toothpaste.',
  },
  {
    title: 'Growing fast',
    body: 'Many babies have roughly doubled their birth weight by now. Growth slows from here — still fast, but not as fast as the first months.',
  },
  {
    title: 'Common allergens',
    body: 'Current guidance supports introducing common allergens like peanut and egg early, once your baby has started other solids — in safe forms, like thinned peanut butter, never whole nuts. Ask your pediatrician first if your baby has severe eczema or a known food allergy.',
  },
  {
    title: 'Six months',
    body: 'Around now is when most babies start solids, alongside breast milk or formula, which still provide most of their nutrition this year. Iron-rich foods are especially important, because the iron babies are born with runs low around six months.',
  },
  {
    title: 'Sips of water',
    body: 'With solids, small sips of water from an open or straw cup are fine. Honey is the one food to keep away until the first birthday, because of the risk of infant botulism.',
    tip: 'Cut round foods like grapes and cherry tomatoes lengthwise into quarters.',
  },
  {
    title: 'Where did it go?',
    body: 'Babies are learning that things still exist when hidden — object permanence. That’s why peek-a-boo suddenly becomes hilarious.',
  },
  {
    title: 'Sitting tall',
    body: 'Many babies now sit steadily on their own and pass toys from one hand to the other. Two free hands make play far more interesting.',
  },
  {
    title: 'Shy with strangers',
    body: 'Wariness of unfamiliar people often appears between six and nine months. It’s a healthy sign that your baby knows who their people are.',
  },
  {
    title: 'On the move',
    body: 'Crawling often starts between seven and ten months — or scooting, or rolling everywhere. Some babies skip crawling entirely and go straight to pulling up.',
    tip: 'Time to baby-proof: cover outlets, secure cords, add stair gates and anchor heavy furniture to the wall.',
  },
  {
    title: 'Finger and thumb',
    body: 'The pincer grasp — picking up small things between thumb and finger — is developing, which makes soft finger foods both possible and fascinating.',
  },
  {
    title: 'Don’t go',
    body: 'Separation anxiety commonly builds between eight and ten months. Crying when you leave means your baby has formed a strong attachment — it fades as they learn you always come back.',
    tip: 'Keep goodbyes short and warm, and don’t sneak away.',
  },
  {
    title: 'Mamama, bababa',
    body: 'Repeated syllables like “mamama” and “bababa” are babbling, usually not yet words with meaning. Repeating them back keeps the conversation going.',
  },
  {
    title: 'Pulling up',
    body: 'Many babies start pulling themselves up to stand on furniture between eight and ten months.',
    tip: 'Lower the crib mattress to its lowest setting before your baby can pull to stand.',
  },
  {
    title: 'Pointing',
    body: 'Waving and pointing often appear between nine and twelve months. Pointing to share something interesting is an important early step in communication.',
  },
  {
    title: 'Understanding more',
    body: 'Babies understand far more words than they can say. Naming things as you point at them — in books, on walks, at meals — builds that understanding fast.',
  },
  {
    title: 'The scientist in the high chair',
    body: 'Dropping food over the edge again and again is an experiment in cause and effect (and in how you react). It passes.',
  },
  {
    title: 'Nine months',
    body: 'A big checklist age: social games, babbling, sitting, and exploring with both hands. Many pediatricians do a general developmental screening around now.',
  },
  {
    title: 'Cruising',
    body: 'Walking sideways while holding on to furniture — cruising — is the usual next step after pulling up. Balance is improving every day.',
  },
  {
    title: 'Two naps',
    body: 'Babies between four months and a year typically sleep about 12 to 16 hours in 24, counting naps. At this age, two naps a day is common.',
  },
  {
    title: 'Try, try again',
    body: 'Babies often need to taste a new food many times — sometimes ten or more — before accepting it. A refused food today might be a favorite next month.',
  },
  {
    title: 'Copycat',
    body: 'Your baby is imitating more: sounds, facial expressions, clapping, pretending to talk on a phone. Imitation is a major way they learn.',
  },
  {
    title: 'Barefoot is best',
    body: 'Indoors, bare feet help new walkers balance and strengthen their feet. Shoes are for protection outside, and should be flexible and light.',
  },
  {
    title: 'In and out',
    body: 'Putting things into containers and taking them out again — and stacking — are favorite games. They build hand skills and an early sense of space and size.',
  },
  {
    title: 'About screens',
    body: 'Pediatricians advise avoiding screen media other than video calls before about 18 months. Babies learn language best from real, responsive people.',
  },
  {
    title: 'First steps',
    body: 'First independent steps can come anywhere from about nine to eighteen months; around the first birthday is common. Wide stance and arms up for balance are typical.',
  },
  {
    title: 'First words',
    body: 'Many babies say a first word with meaning around their first birthday — and a sound used consistently for one thing (like “ba” for ball) counts.',
  },
  {
    title: 'Rear-facing',
    body: 'Keep your baby rear-facing in the car for as long as possible — until they reach the highest weight or height their car seat allows for rear-facing.',
  },
  {
    title: 'Bottles and cups',
    body: 'Around the first birthday is a good time to start moving from bottles to cups. Whole cow’s milk can usually be offered as a drink from 12 months.',
  },
  {
    title: 'Almost one',
    body: 'In one year, most babies roughly triple their birth weight and grow about half again as long — more growth than in any other year of life.',
  },
];

/** Index = completed months, 12 to 35. */
export const MONTHS: Record<number, AgeNote> = {
  12: {
    title: 'One year',
    body: 'Happy birthday! Whole cow’s milk can become a main drink now if you choose (breastfeeding can continue as long as you both like), and honey is now okay.',
    tip: 'The 12-month milestone checklist is in Development.',
  },
  13: {
    title: 'Toddling',
    body: 'New walkers are wobbly, with feet wide apart and arms up. Falls are part of learning; a safe space to practice helps more than holding hands all the time.',
  },
  14: {
    title: 'Understanding takes off',
    body: 'Your toddler probably understands simple requests and many names of people and things, even with only a few spoken words.',
  },
  15: {
    title: 'Fifteen months',
    body: 'Toddlers understand much more than they can express, and that gap is a common source of frustration and early tantrums.',
    tip: 'Naming the feeling (“You’re mad the bath is over”) helps, even before they have the words.',
  },
  16: {
    title: 'Explorer with a home base',
    body: 'Toddlers wander off to explore and then check back with you — a look, a return trip, a toy to show. You’re their secure base.',
  },
  17: {
    title: 'Molars',
    body: 'The first molars often come in between about 13 and 19 months and can make chewing uncomfortable for a few days.',
  },
  18: {
    title: 'Eighteen months',
    body: 'Many toddlers start learning new words much faster around now. Pediatricians commonly do developmental and autism screening at 18 and 24 months.',
  },
  19: {
    title: 'Let’s pretend',
    body: 'Pretend play begins: feeding a doll, stirring a pot, talking on a toy phone. It’s an early sign of imagination and understanding how things are used.',
  },
  20: {
    title: 'One nap',
    body: 'Most toddlers have moved to one afternoon nap. Toddlers typically need about 11 to 14 hours of sleep in 24, including the nap.',
  },
  21: {
    title: 'Putting words together',
    body: 'Two-word combinations like “more milk” or “daddy go” often appear between 18 and 24 months.',
  },
  22: {
    title: 'Climb everything',
    body: 'Running and climbing are favorite activities. Anchor furniture, keep windows locked, and move climbable things away from them.',
  },
  23: {
    title: 'Side by side',
    body: 'Toddlers often play next to other children rather than with them — parallel play. Sharing is genuinely hard at this age; that’s normal.',
  },
  24: {
    title: 'Two years',
    body: 'Vocabulary grows quickly through the third year, and short sentences start to appear. Lots of talking, reading and naming things helps.',
  },
  25: {
    title: 'Potty readiness',
    body: 'Signs of toilet-training readiness usually show up somewhere between 18 months and three years: staying dry for a couple of hours, interest in the toilet, telling you about a wet diaper. Readiness matters more than age.',
  },
  26: {
    title: 'Big feelings',
    body: 'Emotions are intense and self-control is still developing. Staying calm, naming feelings and keeping routines predictable help toddlers learn to settle.',
  },
  27: {
    title: 'Picky eating',
    body: 'Appetites often drop after the first year because growth slows down. Offering a variety without pressure — you choose what, they choose how much — tends to work best.',
  },
  28: {
    title: '“What’s that?”',
    body: 'The questions begin. Answering simply and asking questions back builds vocabulary and conversation skills.',
  },
  29: {
    title: 'Clever hands',
    body: 'Twisting lids, turning pages one at a time, stacking taller towers: fine motor skills are improving fast.',
  },
  30: {
    title: 'Thirty months',
    body: 'Another checklist age, with more pretend play, two-step instructions, and lots more words. Many pediatricians do a developmental screening around now.',
  },
  31: {
    title: 'Playing together',
    body: 'Real back-and-forth play with other children is starting, though turn-taking still needs a lot of help.',
  },
  32: {
    title: 'Crib to bed',
    body: 'Many children move from a crib to a bed between two and three and a half — often when they start climbing out.',
  },
  33: {
    title: 'Imagination and fears',
    body: 'A growing imagination can bring new fears, like of the dark or of monsters. Taking them seriously and offering comfort (a night-light, a check under the bed) helps.',
  },
  34: {
    title: 'Colors and counting',
    body: 'Many children begin naming some colors and reciting a few numbers. Understanding what the numbers mean comes later.',
  },
  35: {
    title: 'Almost three',
    body: 'Most nearly-three-year-olds talk in short sentences that familiar people understand most of the time, and can hold a simple conversation.',
  },
};

/** Which note applies: the week (first year), else the month, capped at three years. */
export function ageNoteKey(ageDays: number): { kind: 'week' | 'month'; n: number } {
  if (ageDays < 52 * 7) return { kind: 'week', n: Math.max(0, Math.floor(ageDays / 7)) };
  // Average month length; close enough for picking a note.
  const months = Math.floor(ageDays / 30.4375);
  return { kind: 'month', n: Math.min(35, Math.max(12, months)) };
}

export function ageNote(key: { kind: 'week' | 'month'; n: number }): AgeNote {
  return key.kind === 'week' ? WEEKS[key.n] : MONTHS[key.n];
}
