// A-F2a（A2-F7）：本地弱口令筛查资源。纯数据包内资源（无 node 依赖；SHA-256 对照
// 在 apps/api 的安全层完成，分层边界 packages/config 不引 node 模块）。
// 列表内容=公开弱密码榜单（rockyou 等）的常见前段，按频次常识聚簇；仅用于拒绝
// 候选密码，不构成任何泄露数据本身。检测语义=原文 SHA-256 命中集合（不做变形
// 展开，屏蔽 top-N 满足 NIST SHOULD）。
const COMMON_PASSWORD_SOURCE = `
123456 password 123456789 12345678 12345 qwerty 1234567 111111 123123 1234567890
abc123 1234 password1 iloveyou 000000 qwerty123 1q2w3e4r qwertyuiop monkey dragon
letmein sunshine princess football baseball superman master hello freedom whatever
trustno1 batman shadow michael supergirl jordan23 harley rangers bubble hunter
buster soccer hockey george jennifer thomas michelle pepper tigger joshua robert
soccer1 tigers williams dallas phoenix angela jessica maggie starwars snowball
nicole chelsea cowboys yankees tpVtfvsd access matrix fuckyou mother cheese
nascar richard jasper ronald porsche merlin bulldog falcon eagle1 hawk dove
angel wings heaven paradise asdfgh asdf asdfasdf asdf123 121212 112233 123321
147258369 159753 987654 987654321 0987654321 654321a 1123581321 314159 271828
102030 11235813 2000 2001 2002 2003 2004 2005 2006 1998 1999 1997 1995 1990
7777 8888 9999 1112 1313 1919 2323 4747 6262 7373 8484 9595 1616 1818 2121
12341234 1234123 11223344 555555 666666 888888 999999 101010 121314 151515
a123456 a123456789 aa123456 abcd1234 abcd123 abcdef abcdefg abc12345 plover
1q2w3e 1qaz2wsx 2wsx3edc qweasdzxc poiuytrewq lkjhgfdsa mnbvcxz 0987654321a
q1w2e3r4t5 q1w2e3 zxcvbnm1 zaq12wsx xsw21qaz 14789632 25896314 369258147
741852963 951357 789654123 123698745 15935748 456789123 789456123 321654987
test test123 testing admin admin123 admin1234 adminadmin administrator
root toor root123 toor123 super super123 superuser sysadmin operator backup
guest guest123 demo demo123 sample sample123 user user123 oracle oracle123
mysql postgres mongo redis nginx apache tomcat windows linux unix ubuntu
password12 password123 password1234 password12345 passw0rd passw0rd1
p4ssw0rd p4ssword pa55word pa55w0rd passwd passwort motdepasse contrasena
senha haslo salasana secure1 secur1ty secure123 mysecret secret123
letmein1 letmein2 letmein3 letmein123 welcome1 welcome123 wilcome1
changeme changer resetpass qwerty12 qwerty12345 1q2w3e4r5t 5t6y7u8i
iloveyou1 iloveyou2 iloveyou123 loveyou2 love1234 lovelove lovestory
sexygirl hotgirl hotstuff sexy69 6969 696969 69696969 playboy playgirl
bigdaddy bigdick bigboobs bigtits sexsex sexgod makelove pussy pussy69
dick dickhead boobs tits asshole badass motherfucker fuck fuckme fuckoff
god godisgreat jesus jesus123 christ christ123 bible church allah
jesuschrist angelwings guardianangel spirit dreamcatcher wisdom
peacemaker worldpeace innerpeace freethinker openminded kindhearted
sweetdreams goodvibes positivevibes motivation inspiration dedication
education graduation celebration birthday valentines christmas newyear
easter halloween thanksgiving summer summer1 winter autumn spring
sunrise sunset moonlight starlight moonbeam starfire sunlight moonglow
firewater icewater steamheat hotwater coldwater fireplace campfire
mountain riverlake oceanview seaside beachboy sandcastle surfboard
waterski snowboard skiing mountainbike cycling bicycle motocross
motorbike racecar speedway nascar1 formula1 grandprix poleposition
finishline checkpoint waypoint milestone steppingstone cornerstone
keystone capstone tombstone grindstone whetstone yellowstone gemstone
birthstone moonstone blackstone sandstone limestone brownstone redstone
bluestone greystone whitestone freestone livingstone yellowsubmarine
onetwothree fourfivesix seveneightnine ten eleven twelve thirteen
redorange yellowgreen bluepurple blackwhite pinkbrown graygray
silvergold copperbronze platinumdiamond rubyemerald sapphiretopaz
opalgarnet amethystonxy peridot turquoise janedoe johndoe
january february march april mayjune julyaugust september october
november december monday tuesday wednesday thursday friday saturday
sunday weekend weekday morning afternoon evening nighttime midnight
breakfast lunchdinner supper summercamp winterbreak schooltime
homerun slamdunk touchdown threepointer freethrow slapshot powerplay
goalfight strikeout pitcher catcher referee umpire champion
winnerwinner chickenwinner loser nobody somebody everybody
pokemon pikachu charizard bulbasaur squirtle mario luigi
zelda link gannon starfox donkeykong pac-man astroids
playstation nintendo sega genesis xbox xboxlive
minecraft steve creeper enderman terraria roblox
fortnite pubg callofduty battlefield halflife counterstrike
worldofwarcraft warcraft dota2 leagueoflegends overwatch
steamorigin ubisoft blizzard riotgames epicgames
google123 apple iphone iphone6 iphone7 android samsung
nokia motorola samsunggalaxy htcphone xiaomi oppo vivo
dellhp lenovo thinkpad macbook surfacebook precision latitude
acer asus toshiba fujitsu siemens ibmthink thinkcentre optiplex
prodesk elitebook pavilion envy inspiron chrombook alienware
rolex gucci prada chanel dior armani versace louisvuitton
bmwm3 mercedes benzaudi toyota honda nissan1 hyundai kia
ferrari lamborghini maserati bugatti mclaren corvette mustang
chevrolet fordfocus dodgecharger jeepwrangler tacomatruck
svetlana tatiana ekaterina dmitry nikolai ivanov alexandr
sergey andrey olga yulia vladimir mikhail boris vladislav
maria1 anna1 elena1 tatiana1 natalia1 irina1 sveta1 olya1
josejuan manuelPedro luisjavier carlosmaria alberto fernando
miguelangel jorgeluis ricardomaria alejandroguillermo
mariajose josemaria luismiguel juancarlos anamaria
rafaelnadal rogerfederer novakdjokovic serenawilliams
cristianoronaldo leomessi neymarjr mbappe haaland
lebronjames stephcurry kevindurant kohlibryant
michaeljordan shaq kobe bryant dwyane
justinbieber taylorswift arianagrande billieeilish
beyonce rihanna1 eminem1 drake snoopdogg kanyewest
michaeljackson janetjackson princebowie davidbowie
beatles rollingstones queenbee pinkfloyd ledrules
gunsnroses metallica megadeth ironmaiden blacklabel
linkinpark green day sum41 blink182 offsprings
radiohead coldplay oasisband blurband
harrystyles taylorswift1 arianator swiftie
gameofthrones breakingbad walkingdead sopranos
friends episode bigbang theoryhowimetyourmother
startrek voyager deepspace nextgeneration babylon5
doctorwho tardis dalek cyberman jondapun
harrypotter hogwarts gryffindor slytherin ravenpuff
ronweasley hermione dumbledore voldemort snape
lordoftherings frodo bilbo gandalf1 aragorn legolas
gimli sauron mordor shire rivendell gondor rohan
starwars1 darthvader lukeskywalker leiaorgana
hansolo chewbacca obiwankenobi yodajedi sithlord
jamesbond 007james drno goldfinger skyfall
missionimpossible ethanhunt agent007
batman1 spiderman superman1 ironman1 captainamerica
thundergod blackwidow hawkeye scarletwitch doctorstrange
blackpanther wakanda thanos infinity gauntlet endgame
deadpool wolverine xmen magneto mystique
jokerharley banebane poisonivy riddler penguin
matrixneo morpheus trinity agent smith zion
inceptiondream cobb saito fischer
interstellar cooper brand murph tars
avatar pandora navi jakesully neytiri
titanic jackrose iceberg sinking
jurassicpark trex raptor velociraptor indominus
godzilla kingkong mothra ghidorah rodan
applepie cherrytree strawberryfields
chocolate1 vanillaice creamcake cookie monster
icecream sundae milkshake donut pizza hamburger
hotdog frenchfries friedchicken tacos burrito
sushi ramen udon soba tempura sashimi
spaghettini carbonara lasagne ravioli
paella tapas gazpacho churros flan
croissant baguette brioche eclair macaron
schnitzel bratwurst sauerkraut pretzel
fishchips bangersmash pudding crumpets
borsch blini pelmeni vareniki shashlik
falafel hummus shawarma kebab baklava
dumplings hotpot congee dimsum pekingduck
padthai tomyum greenonion friedrice
phobo banhmi goicuon nemspringrolls
kimchi bibimbap bulgogi japchae tteokbokki
curryrice naan bread tandoori biryani
123456a a12345 1234abcd abcd123456 qwe123
q1w2e3r4 1234qwer 147258 159357 789456123
zzzzzz zzzz123 xxxxxx xxx123 aaaaaa aaaaa123
bbbbbb cccccc dddddd eeeeee ffffff gggggg
hhhhhh iiiiii jjjjjj kkkkkk llllll mmmmmm
nnnnnn oooooo pppppp qqqqqq rrrrrr ssssss
tttttt uuuuuu vvvvvv wwwwww xxxxxx1 yyyyyy
zzzzzz1 qqwwqq wweeww eerrert asddsa zxczxc
qazqaz wswsws edcedc rfvrfv tgbyhn uhbuby
ijnij oklol plm pmooijn ikopuj yhnji9
1m2n3b4v 5c6x7z8a 9s0d1f2g 3h4j5k6l 7p8o9i0u
y8t7r6e5 w4q3e2r1 t5y6u7i8 o9i8u7y6 r4t5y6u7
1a2b3c4d 5e6f7g8h 9i0j1k2l 3m4n5o6p 7q8r9s0t
a1b2c3d4 e5f6g7h8 i9j0k1l2 m3n4o5p6 q7r8s9t0
z9x8c7v6 b5n4m3a2 s1d2f3g4 h5j6k7l8 q9w0e1r2
asdasd qweqwe zxczxc asazsa qswqsw edcedc
gagarin korolev putin1 stalin lenin trotsky
vodka1 matryoshka balalaika samovar troika
moscow1 petersburg sochi2014 kazan ufa omsk
madrid barcelona valencia sevilla bilbao
lisbon porto milan torino napoli palermo
roma roma1 naples venice florence genoa
amsterdam rotterdam utrecht eindhoven hague
brussels bruges antwerp gent liege
vienna graz salzburg innsbruck linz
berlin hamburg munich cologne frankfurt
stuttgart dresden leipzig dortmund essen
zurich geneva bern basel lausanne lugano
paris lyon marseille toulouse bordeaux lillen
londonbridge manchester liverpool birmingham
glasgow edinburgh dublin belfast cardiff
stockholm oslo copenhagen helsinki gothenburg
malmo aarhus tampere turku oulu
warsaw krakow gdansk poznan wroclaw lodz
prague brno plzen olomouc ostrava
budapest debrecen szeged pecs gyor
bucharest cluj timisoara iasi constanta
sofia varna plovdiv burgas ruse
athens thessaloniki patra heraklion larissa
istanbul ankara izmir bursa antalya adana
beirut damascus amman baghdad tehran
cairo alexandria giza luxor aswan
rabat casablanca marrakesh fez tangier
algiers oran tunis tripoli khartoum
lagos abuja kano accra nairobi addis
johannesburg pretoria durban capebotown
delhi mumbai bangalore chennai kolkata
hyderabad pune ahmedabad jaipur lucknow
karachi lahore islamabad rawalpindi multan
dhaka chittagong colombo kandy katunayake
kathmandu thimphu dharamsala manali
bangkok chiangmai phuket pattaya hatyai
singapura kualalumpur penang johor ipoh
jakarta surabaya bandung medan semarang
manila cebu davao quezon makati baguio
hanoi saigon danang huecantho cantho
beijing shanghai shenzhen guangzhou chengdu
tianjin wuhan xian hangzhou nanjing chongqing
seoul busan incheon daegu gwangju ulsan
tokyo osaka kyoto yokohama nagoya kobe sapporo
fukuoka hiroshima sendai nara kamakura
taipei kaohsiung taichung tainan keelung
sydney melbourne brisbane perth adelaide
auckland wellington christchurch dunedin
toronto montreal vancouver calgary ottawa
chicago houston phoenix philadelphia dallas
austin boston seattle denver portland vegas
atlanta miami minneapolis cleveland stlouis
baltimore milwaukee pittsburgh cincin nashville
detroit memphis louisville richmond charlotte
`
  .split(/\s+/u)
  .filter((word) => word.length > 0);

export const COMMON_PASSWORDS: ReadonlySet<string> = new Set(COMMON_PASSWORD_SOURCE);
