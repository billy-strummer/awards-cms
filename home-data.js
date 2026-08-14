/**
 * home-data.js — single source of truth for all public-facing page data.
 *
 * Loaded as a plain <script> (NOT type="module") on home.html, submit-entry.html,
 * and nominate.html, so the data is available synchronously before the page
 * scripts run.  When you add a new sector, category, region, or county/city,
 * update this ONE file — every page updates automatically.
 *
 * Sets:
 *   window.BTA_HOME_DATA      — full structured object (used by home.html)
 *   window.REGION_DATA        — 3-level region hierarchy (submit-entry.js, nominate.js)
 *   window.SECTORS            — flat sector name array (config.js backward compat)
 *   window.STANDARD_CATEGORIES — sector→categories map (config.js backward compat)
 */
(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     1. SECTORS & CATEGORIES
     Mirrors STANDARD_CATEGORIES in config.js.
     To add/remove categories: edit this object.
     To add a new sector: add a new key + entry in SECTOR_META below.
  ───────────────────────────────────────────── */
  const SECTOR_CATEGORIES = {
    'BUILDING & CONSTRUCTION': [
      'Brickwork & Masonry Company',
      'Drainage Company',
      'Extension Company',
      'General Building Company',
      'Groundworks & Foundations Company',
      'Guttering Company',
      'Loft Conversion Company',
      'Maintenance Services',
      'New Build Company',
      'Roofing Company',
      'Structural Engineers',
      'Structural Steelworks',
    ],
    'MECHANICAL, ELECTRICAL & PLUMBING': [
      'Air-Conditioning & Ventilation Company',
      'Electrical Company',
      'Heating Company',
      'Plumbing Company',
      'Underfloor Heating Company',
    ],
    'CARPENTRY & JOINERY': [
      'Cabinet Maker',
      'Carpentry Company',
      'Joinery Company',
      'Staircase Specialist',
      'Timber Windows Installer',
    ],
    'FIT-OUT & FINISHING': [
      'Bathroom Installer',
      'Carpet Fitters',
      'Curtains & Blinds Installer',
      'Drylining Company',
      'Flooring Installer',
      'Home Office Installer',
      'Interior Refurbishment Company',
      'Kitchen Installer',
      'Painting & Decorating Company',
      'Plastering Company',
      'Screeding Company',
      'Tiling Installer',
    ],
    'OUTDOOR & LANDSCAPING': [
      'Decking Company',
      'Driveway & Paving Company',
      'Fencing Installer',
      'Gardening Services',
      'Garden Outbuilding Company',
      'Landscaping & Garden Design Company',
      'Outdoor Lighting & Electrical Company',
      'Tree Surgery Services',
    ],
    'ENERGY, TECH & SUSTAINABILITY': [
      'EV Charger Installer',
      'Insulation & Energy Efficiency Company',
      'PV Installer',
      'Renewable Energy Specialist',
      'Security Systems Installer',
      'Smart Home & Automation Company',
    ],
    'SPECIALIST TRADES': [
      'Asbestos Removal Specialist',
      'Locksmith',
      'Pest Control Company',
      'Rendering Company',
      'Scaffolding Company',
      'Shop Fitting Company',
      'Swimming Pool & Hot Tub Company',
      'Window & Door Installer',
    ],
    'INDUSTRY LEADERSHIP': [
      'Apprentice of the Year',
      'Lifetime Achievement Award',
      'Community Impact Award',
      'Female Tradesperson of the Year',
      'Male Tradesperson of the Year',
      'New Business of the Year',
    ],
  };

  /* ─────────────────────────────────────────────
     2. SECTOR DISPLAY META
     Controls how each sector renders on home.html:
     image, display name, short description, aria label.
     Add a matching entry here whenever you add a new sector above.
  ───────────────────────────────────────────── */
  const SECTOR_META = {
    'BUILDING & CONSTRUCTION': {
      image: 'building-construction.jpg',
      displayName: 'Building & Construction',
      description: 'Extensions, Roofing, Maintenance, Groundworks, Loft Conversions, Drainage & more...',
      ariaLabel:
        'Building and Construction — Extensions, Roofing, Maintenance, Groundworks, Loft Conversions, Drainage & more',
    },
    'MECHANICAL, ELECTRICAL & PLUMBING': {
      image: 'mechanical-electrical-plumbing.jpg',
      displayName: 'Mechanical, Engineering & Plumbing',
      description: 'Electrics, Heating, Plumbing, Air-Conditioning & more…',
      ariaLabel: 'Mechanical, Engineering and Plumbing — Electrics, Heating, Plumbing, Air-Conditioning & more',
    },
    'CARPENTRY & JOINERY': {
      image: 'carpentry-joinery.jpg',
      displayName: 'Carpentry & Joinery',
      description: 'Bespoke Woodworking: Cabinets, Staircases, Timber Windows & more…',
      ariaLabel: 'Carpentry and Joinery — Bespoke Woodworking: Cabinets, Staircases, Timber Windows & more',
    },
    'FIT-OUT & FINISHING': {
      image: 'interior-fitout.jpg',
      displayName: 'Fit-Out & Finishing',
      description: 'Bathrooms, Kitchens, Carpets & Flooring, Painting & Decorating, Plastering, Tiling & more…',
      ariaLabel:
        'Fit-Out and Finishing — Bathrooms, Kitchens, Carpets & Flooring, Painting & Decorating, Plastering, Tiling & more',
    },
    'OUTDOOR & LANDSCAPING': {
      image: 'outdoor-landscaping.jpg',
      displayName: 'Outdoors & Landscaping',
      description: 'Gardening, Driveways, Fencing, Decking, Tree Surgery & more',
      ariaLabel: 'Outdoors and Landscaping — Gardening, Driveways, Fencing, Decking, Tree Surgery & more',
    },
    'ENERGY, TECH & SUSTAINABILITY': {
      image: 'energy-tech-sustainability.jpg',
      displayName: 'Tech & Green Energy',
      description: 'EV Chargers, Renewable Energy, Security Systems, Smart Homes & more',
      ariaLabel: 'Tech and Green Energy — EV Chargers, Renewable Energy, Security Systems, Smart Homes & more',
    },
    'SPECIALIST TRADES': {
      image: 'specialist-trades.jpg',
      displayName: 'Specialist Trades',
      description: 'Locksmiths, Pest Control, Scaffolding, Windows & Doors & more',
      ariaLabel: 'Specialist Trades — Locksmiths, Pest Control, Scaffolding, Windows & Doors & more',
    },
    'INDUSTRY LEADERSHIP': {
      image: 'industry-leadership.jpg',
      displayName: 'Industry Leadership',
      description: 'Recognising extraordinary individuals',
      ariaLabel: 'Industry Leadership — Recognising extraordinary individuals',
    },
  };

  /* ─────────────────────────────────────────────
     3. REGION DATA — 3-level hierarchy
     country → region group → counties / cities
     Used by:
       - home.html  (regional accordion)
       - submit-entry.js  (country→region→city picker)
       - nominate.js      (country→region→city picker)
     To add a new county or city: add it to the array for its region group.
  ───────────────────────────────────────────── */
  const REGION_DATA = {
    england: {
      Counties: [
        'Bedfordshire',
        'Berkshire',
        'Buckinghamshire',
        'Cambridgeshire',
        'Cheshire',
        'Cornwall',
        'County Durham',
        'Cumbria',
        'Derbyshire',
        'Devon',
        'Dorset',
        'East Sussex',
        'East Yorkshire',
        'Essex',
        'Gloucestershire',
        'Hampshire',
        'Herefordshire',
        'Hertfordshire',
        'Isle of Wight',
        'Kent',
        'Lancashire',
        'Leicestershire',
        'Lincolnshire',
        'Norfolk',
        'Northamptonshire',
        'North Yorkshire',
        'Northumberland',
        'Nottinghamshire',
        'Oxfordshire',
        'Rutland',
        'Shropshire',
        'Somerset',
        'South Yorkshire',
        'Staffordshire',
        'Suffolk',
        'Surrey',
        'Tyne & Wear',
        'Warwickshire',
        'West Sussex',
        'West Yorkshire',
        'Wiltshire',
        'Worcestershire',
      ],
      Cities: [
        'Birmingham',
        'Bournemouth',
        'Brighton & Hove',
        'Bristol',
        'Coventry',
        'Leeds',
        'Leicester',
        'Liverpool',
        'Manchester',
        'Middlesbrough',
        'Newcastle',
        'Nottingham',
        'Reading',
        'Sheffield',
        'Southampton',
      ],
      'London Boroughs': [
        'Bromley',
        'Camden',
        'Croydon',
        'Greenwich',
        'Hackney',
        'Hammersmith & Fulham',
        'Islington',
        'Kensington & Chelsea',
        'Kingston & Richmond',
        'Lambeth',
        'Lewisham',
        'Middlesex',
        'Southwark',
        'Westminster',
        'Wandsworth',
      ],
    },
    scotland: {
      'Counties & Areas': [
        'Argyll & Bute',
        'Ayrshire',
        'Central Scotland',
        'Dumfries & Galloway',
        'Dunbartonshire',
        'Fife',
        'Grampian',
        'Highlands',
        'Lanarkshire',
        'Lothian',
        'Renfrewshire',
        'Scottish Borders',
        'Scottish Islands',
        'Tayside',
      ],
      Cities: ['Edinburgh', 'Glasgow'],
    },
    wales: {
      'Counties & Areas': [
        'Carmarthenshire',
        'Ceredigion',
        'Conwy & Denbighshire',
        'Flintshire',
        'Glamorgan',
        'Gwent',
        'Gwynedd & Anglesey',
        'Pembrokeshire',
        'Powys',
        'Wrexham',
      ],
      Cities: ['Cardiff', 'Swansea'],
    },
    'northern-ireland': {
      Belfast: ['Belfast City Centre', 'North Belfast', 'South Belfast', 'East Belfast', 'West Belfast'],
      'Antrim & Newtownabbey': ['Antrim', 'Newtownabbey', 'Ballyclare', 'Randalstown'],
      'Ards & North Down': ['Bangor', 'Newtownards', 'Holywood', 'Comber', 'Donaghadee'],
      'Armagh, Banbridge & Craigavon': ['Armagh', 'Banbridge', 'Craigavon', 'Lurgan', 'Portadown'],
      'Causeway Coast & Glens': ['Coleraine', 'Ballycastle', 'Limavady', 'Ballymoney', 'Portrush'],
      'Derry & Strabane': ['Derry / Londonderry', 'Strabane'],
      'Fermanagh & Omagh': ['Enniskillen', 'Omagh', 'Irvinestown'],
      'Lisburn & Castlereagh': ['Lisburn', 'Castlereagh', 'Dromore'],
      'Mid & East Antrim': ['Ballymena', 'Carrickfergus', 'Larne'],
      'Mid Ulster': ['Cookstown', 'Magherafelt', 'Dungannon', 'Maghera'],
      'Newry, Mourne & Down': ['Newry', 'Newcastle', 'Downpatrick', 'Warrenpoint'],
    },
  };

  /* ─────────────────────────────────────────────
     4. FLAG MAP — location name → /images/flags/<filename>
     Used by home.html regional accordion chips.
     To add a flag: drop the image in /images/flags/ and add the entry here.
  ───────────────────────────────────────────── */
  const FLAG_MAP = {
    // North West
    Cheshire: 'Cheshire.png',
    Cumbria: 'Cumbria.png',
    Lancashire: 'Lancashire.png',
    Liverpool: 'Liverpool County_Merseyside.png',
    Manchester: 'Manchester.png',
    // North East
    'County Durham': 'County Durham.png',
    Northumberland: 'Northumberland.png',
    'Tyne & Wear': 'Tyne & Wear.png',
    Newcastle: 'Newcastle.png',
    Middlesbrough: 'Middlesbrough.png',
    // Yorkshire
    'East Yorkshire': 'East Yorkshire.png',
    'North Yorkshire': 'North Yorkshire.png',
    'South Yorkshire': 'Unofficial_South Yorkshire.png',
    'West Yorkshire': 'West Yorkshire.png',
    Leeds: 'Leeds diocese.png',
    Sheffield: 'Sheffield diocese.png',
    // East Midlands
    Derbyshire: 'Derbyshire.png',
    Leicestershire: 'Leicestershire.png',
    Lincolnshire: 'Lincolnshire.png',
    Northamptonshire: 'Northamptonshire.png',
    Nottinghamshire: 'Nottinghamshire.png',
    Rutland: 'Rutland.png',
    Leicester: 'Leicester diocese.png',
    Nottingham: 'Nottingham diocese.png',
    // West Midlands
    Herefordshire: 'Herefordshire.png',
    Shropshire: 'Shropshire.png',
    Staffordshire: 'Staffordshire.png',
    Warwickshire: 'Warwickshire.png',
    Worcestershire: 'Worcestershire.png',
    Birmingham: 'Birmingham.png',
    Coventry: 'Coventry.png',
    // East of England
    Bedfordshire: 'Bedfordshire.png',
    Cambridgeshire: 'Cambridgeshire.png',
    Essex: 'Essex.png',
    Hertfordshire: 'Hertfordshire.png',
    Norfolk: 'Norfolk.png',
    Suffolk: 'Suffolk.png',
    // London boroughs — individual flags
    London: 'London.png',
    Middlesex: 'Middlesex.png',
    Bromley: 'Bromley.png',
    Camden: 'Camden.png',
    Croydon: 'Croydon.png',
    Greenwich: 'Greenwich.png',
    Hackney: 'Hackney.png',
    'Hammersmith & Fulham': 'Hammersmith & Fulham.png',
    Islington: 'Islington.png',
    'Kensington & Chelsea': 'Kensington & Chelsea.png',
    'Kingston & Richmond': 'Kingston.png',
    Lambeth: 'Lambeth.png',
    Lewisham: 'Lewisham.png',
    Southwark: 'Southwark.png',
    Wandsworth: 'Wandsworth.png',
    Westminster: 'Westminster.png',
    // South East
    Berkshire: 'Berkshire.png',
    Buckinghamshire: 'Buckinghamshire.png',
    'East Sussex': 'East Sussex.png',
    Hampshire: 'Hampshire.png',
    'Isle of Wight': 'Isle of Wight.png',
    Kent: 'Kent.png',
    Oxfordshire: 'Oxfordshire.png',
    Surrey: 'Surrey.png',
    'West Sussex': 'West Sussex.png',
    'Brighton & Hove': 'Brighton & Hove.png',
    Southampton: 'Southampton.png',
    // South West
    Cornwall: 'Cornwall.png',
    Devon: 'Devon.png',
    Dorset: 'Dorset.png',
    Gloucestershire: 'Gloucestershire.png',
    Somerset: 'Somerset.png',
    Wiltshire: 'Wiltshire.png',
    Bournemouth: 'Bournemouth.png',
    Bristol: 'Bristol.png',
    // Wales
    Cardiff: 'Cardiff.png',
    Swansea: 'Swansea.png',
    Wrexham: 'Wrexham.png',
    Anglesey: 'Anglesey.png',
    Carmarthen: 'Carmarthenshire.png',
    Ceredigion: 'Ceredigion.png',
    Conwy: 'Conwy Wales.png',
    Denbighshire: 'Denbighshire.png',
    Flintshire: 'Flintshire.png',
    Glamorgan: 'Glamorgan.png',
    Gwent: 'Gwent.png',
    Gwynedd: 'Gwynedd.png',
    Pembrokeshire: 'Pembrokeshire.png',
    Powys: 'Powys.png',
    'Conwy & Denbighshire': 'Conwy Wales.png',
    'Gwynedd & Anglesey': 'Gwynedd.png',
    Carmarthenshire: 'Carmarthenshire.png',
    // Scotland (Edinburgh & Glasgow have individual flags; all others use Scotland.png)
    Edinburgh: 'Edinburgh.png',
    Glasgow: 'Glasgow.png',
    Stirling: 'BTA_Corporate_Horizontal-gold-white.png',
    Falkirk: 'BTA_Corporate_Horizontal-gold-white.png',
    Clackmannanshire: 'BTA_Corporate_Horizontal-gold-white.png',
    Lanarkshire: 'BTA_Corporate_Horizontal-gold-white.png',
    Dunbartonshire: 'BTA_Corporate_Horizontal-gold-white.png',
    Inverness: 'BTA_Corporate_Horizontal-gold-white.png',
    'Fort William': 'BTA_Corporate_Horizontal-gold-white.png',
    Elgin: 'BTA_Corporate_Horizontal-gold-white.png',
    Aviemore: 'BTA_Corporate_Horizontal-gold-white.png',
    Wick: 'BTA_Corporate_Horizontal-gold-white.png',
    Aberdeen: 'BTA_Corporate_Horizontal-gold-white.png',
    Fraserburgh: 'BTA_Corporate_Horizontal-gold-white.png',
    Peterhead: 'BTA_Corporate_Horizontal-gold-white.png',
    Inverurie: 'BTA_Corporate_Horizontal-gold-white.png',
    Dundee: 'BTA_Corporate_Horizontal-gold-white.png',
    Perth: 'BTA_Corporate_Horizontal-gold-white.png',
    Arbroath: 'BTA_Corporate_Horizontal-gold-white.png',
    Kirriemuir: 'BTA_Corporate_Horizontal-gold-white.png',
    'St Andrews': 'BTA_Corporate_Horizontal-gold-white.png',
    Dunfermline: 'BTA_Corporate_Horizontal-gold-white.png',
    Kirkcaldy: 'BTA_Corporate_Horizontal-gold-white.png',
    Glenrothes: 'BTA_Corporate_Horizontal-gold-white.png',
    Livingston: 'BTA_Corporate_Horizontal-gold-white.png',
    Haddington: 'BTA_Corporate_Horizontal-gold-white.png',
    Linlithgow: 'BTA_Corporate_Horizontal-gold-white.png',
    Paisley: 'BTA_Corporate_Horizontal-gold-white.png',
    Ayr: 'BTA_Corporate_Horizontal-gold-white.png',
    Kilmarnock: 'BTA_Corporate_Horizontal-gold-white.png',
    Hamilton: 'BTA_Corporate_Horizontal-gold-white.png',
    Greenock: 'BTA_Corporate_Horizontal-gold-white.png',
    Ayrshire: 'BTA_Corporate_Horizontal-gold-white.png',
    Renfrewshire: 'BTA_Corporate_Horizontal-gold-white.png',
    'Argyll & Bute': 'BTA_Corporate_Horizontal-gold-white.png',
    Galashiels: 'BTA_Corporate_Horizontal-gold-white.png',
    Hawick: 'BTA_Corporate_Horizontal-gold-white.png',
    Jedburgh: 'BTA_Corporate_Horizontal-gold-white.png',
    Peebles: 'BTA_Corporate_Horizontal-gold-white.png',
    'Scottish Borders': 'BTA_Corporate_Horizontal-gold-white.png',
    // Scotland region-level names (used by updated REGION_DATA)
    'Central Scotland': 'BTA_Corporate_Horizontal-gold-white.png',
    'Dumfries & Galloway': 'BTA_Corporate_Horizontal-gold-white.png',
    Fife: 'BTA_Corporate_Horizontal-gold-white.png',
    Grampian: 'BTA_Corporate_Horizontal-gold-white.png',
    Highlands: 'BTA_Corporate_Horizontal-gold-white.png',
    Lothian: 'BTA_Corporate_Horizontal-gold-white.png',
    'Scottish Islands': 'BTA_Corporate_Horizontal-gold-white.png',
    Tayside: 'BTA_Corporate_Horizontal-gold-white.png',
    Dumfries: 'BTA_Corporate_Horizontal-gold-white.png',
    Stranraer: 'BTA_Corporate_Horizontal-gold-white.png',
    'Newton Stewart': 'BTA_Corporate_Horizontal-gold-white.png',
    Kirkcudbright: 'BTA_Corporate_Horizontal-gold-white.png',
    Skye: 'BTA_Corporate_Horizontal-gold-white.png',
    Orkney: 'BTA_Corporate_Horizontal-gold-white.png',
    Shetland: 'BTA_Corporate_Horizontal-gold-white.png',
    Lewis: 'BTA_Corporate_Horizontal-gold-white.png',
    Arran: 'BTA_Corporate_Horizontal-gold-white.png',
    // English cities without individual flags → England.png placeholder
    Gateshead: 'BTA_Corporate_Horizontal-gold-white.png',
    Sunderland: 'BTA_Corporate_Horizontal-gold-white.png',
    Bradford: 'BTA_Corporate_Horizontal-gold-white.png',
    York: 'BTA_Corporate_Horizontal-gold-white.png',
    Hull: 'BTA_Corporate_Horizontal-gold-white.png',
    Reading: 'BTA_Corporate_Horizontal-gold-white.png',
    // Welsh towns/cities without individual flags → Wales.png placeholder
    Bangor: 'BTA_Corporate_Horizontal-gold-white.png',
    Llandudno: 'BTA_Corporate_Horizontal-gold-white.png',
    Rhyl: 'BTA_Corporate_Horizontal-gold-white.png',
    Holyhead: 'BTA_Corporate_Horizontal-gold-white.png',
    Aberystwyth: 'BTA_Corporate_Horizontal-gold-white.png',
    Welshpool: 'BTA_Corporate_Horizontal-gold-white.png',
    Newtown: 'BTA_Corporate_Horizontal-gold-white.png',
    Brecon: 'BTA_Corporate_Horizontal-gold-white.png',
    'Llandrindod Wells': 'BTA_Corporate_Horizontal-gold-white.png',
    Neath: 'BTA_Corporate_Horizontal-gold-white.png',
    'Port Talbot': 'BTA_Corporate_Horizontal-gold-white.png',
    Pembroke: 'BTA_Corporate_Horizontal-gold-white.png',
    'Milford Haven': 'BTA_Corporate_Horizontal-gold-white.png',
    Newport: 'BTA_Corporate_Horizontal-gold-white.png',
    'Merthyr Tydfil': 'BTA_Corporate_Horizontal-gold-white.png',
    Tredegar: 'BTA_Corporate_Horizontal-gold-white.png',
    'Ebbw Vale': 'BTA_Corporate_Horizontal-gold-white.png',
    Pontypool: 'BTA_Corporate_Horizontal-gold-white.png',
    'Vale of Glamorgan': 'BTA_Corporate_Horizontal-gold-white.png',
    Rhondda: 'BTA_Corporate_Horizontal-gold-white.png',
    Pontypridd: 'BTA_Corporate_Horizontal-gold-white.png',
    Caerphilly: 'BTA_Corporate_Horizontal-gold-white.png',
    Bridgend: 'BTA_Corporate_Horizontal-gold-white.png',
    // Northern Ireland → United Kingdom.png placeholder
    'Belfast City Centre': 'BTA_Corporate_Horizontal-gold-white.png',
    'North Belfast': 'BTA_Corporate_Horizontal-gold-white.png',
    'South Belfast': 'BTA_Corporate_Horizontal-gold-white.png',
    'East Belfast': 'BTA_Corporate_Horizontal-gold-white.png',
    'West Belfast': 'BTA_Corporate_Horizontal-gold-white.png',
    Antrim: 'BTA_Corporate_Horizontal-gold-white.png',
    Newtownabbey: 'BTA_Corporate_Horizontal-gold-white.png',
    Ballyclare: 'BTA_Corporate_Horizontal-gold-white.png',
    Randalstown: 'BTA_Corporate_Horizontal-gold-white.png',
    Newtownards: 'BTA_Corporate_Horizontal-gold-white.png',
    Holywood: 'BTA_Corporate_Horizontal-gold-white.png',
    Comber: 'BTA_Corporate_Horizontal-gold-white.png',
    Donaghadee: 'BTA_Corporate_Horizontal-gold-white.png',
    Armagh: 'BTA_Corporate_Horizontal-gold-white.png',
    Banbridge: 'BTA_Corporate_Horizontal-gold-white.png',
    Craigavon: 'BTA_Corporate_Horizontal-gold-white.png',
    Lurgan: 'BTA_Corporate_Horizontal-gold-white.png',
    Portadown: 'BTA_Corporate_Horizontal-gold-white.png',
    Coleraine: 'BTA_Corporate_Horizontal-gold-white.png',
    Ballycastle: 'BTA_Corporate_Horizontal-gold-white.png',
    Limavady: 'BTA_Corporate_Horizontal-gold-white.png',
    Ballymoney: 'BTA_Corporate_Horizontal-gold-white.png',
    Portrush: 'BTA_Corporate_Horizontal-gold-white.png',
    'Derry / Londonderry': 'BTA_Corporate_Horizontal-gold-white.png',
    Strabane: 'BTA_Corporate_Horizontal-gold-white.png',
    Enniskillen: 'BTA_Corporate_Horizontal-gold-white.png',
    Omagh: 'BTA_Corporate_Horizontal-gold-white.png',
    Irvinestown: 'BTA_Corporate_Horizontal-gold-white.png',
    Lisburn: 'BTA_Corporate_Horizontal-gold-white.png',
    Castlereagh: 'BTA_Corporate_Horizontal-gold-white.png',
    Dromore: 'BTA_Corporate_Horizontal-gold-white.png',
    Ballymena: 'BTA_Corporate_Horizontal-gold-white.png',
    Carrickfergus: 'BTA_Corporate_Horizontal-gold-white.png',
    Larne: 'BTA_Corporate_Horizontal-gold-white.png',
    Cookstown: 'BTA_Corporate_Horizontal-gold-white.png',
    Magherafelt: 'BTA_Corporate_Horizontal-gold-white.png',
    Dungannon: 'BTA_Corporate_Horizontal-gold-white.png',
    Maghera: 'BTA_Corporate_Horizontal-gold-white.png',
    Newry: 'BTA_Corporate_Horizontal-gold-white.png',
    Downpatrick: 'BTA_Corporate_Horizontal-gold-white.png',
    Warrenpoint: 'BTA_Corporate_Horizontal-gold-white.png',
  };

  /* ─────────────────────────────────────────────
     5. CATEGORY DESCRIPTIONS — one per category for the modal detail view
  ───────────────────────────────────────────── */
  const CATEGORY_DESCRIPTIONS = {
    // BUILDING & CONSTRUCTION
    'Brickwork & Masonry Company':
      'This category recognises excellence in brick, block and stonework services, including new walls, extensions and new builds, repointing, chimney work, and heritage restoration. Winners demonstrate exceptional technical expertise, safe working practices, relevant building regulations compliance, alongside excellent customer satisfaction.',
    'Drainage Company':
      'This category recognises excellence in foul and surface water drainage services, including installations, repairs, drain relining, excavations, soakaways and flood prevention, blocked drain clearance, and CCTV surveys. Winners demonstrate exceptional technical expertise, safe working practices, relevant regulatory compliance, and excellent customer satisfaction.',
    'Extension Company':
      'This category recognises excellence in delivering extension projects, including single- and multi-storey additions, side-return extensions, wraparounds, structural alterations and full project management. Winners demonstrate exceptional technical expertise, relevant building regulations compliance, safe working practices, and excellent customer satisfaction.',
    'General Building Company':
      'This category recognises excellence in comprehensive building services, including renovations, extensions, structural alterations and repairs. Winners demonstrate exceptional technical expertise, safe working practices, relevant building regulations compliance, and excellent customer satisfaction.',
    'Groundworks & Foundations Company':
      'This category recognises excellence in groundworks and foundation services, including excavations, concrete foundations, underpinning, retaining structures, piling, drainage installation, and site clearance. Winners demonstrate exceptional technical expertise, safe excavation and temporary working practices, relevant building regulations compliance, and excellent customer satisfaction.',
    'Guttering Company':
      'This category recognises excellence in roofline and rainwater management services, including installation, repairs and replacement of gutters, downpipes, fascias and soffits, gutter cleaning, maintenance programmes and rainwater system upgrades. Winners demonstrate exceptional technical expertise, safe working practices, relevant regulatory compliance, and excellent customer satisfaction.',
    'Loft Conversion Company':
      'This category recognises excellence in loft conversion services, including dormer, hip-to-gable, mansard and rooflight conversions, structural strengthening, fire-safety upgrades, staircase installation and building regulations management. Winners demonstrate exceptional technical expertise, safe working practices, relevant building regulations compliance, and excellent customer satisfaction.',
    'Maintenance Services':
      'This category recognises excellence in property maintenance services, including planned maintenance programmes, reactive repairs, handyman services, minor building works and seasonal property care. Winners demonstrate exceptional technical expertise, safe working practices, relevant regulatory compliance, and excellent customer satisfaction.',
    'New Build Company':
      'This category recognises excellence in the construction of new-build residential properties, including detached and semi-detached houses, bespoke homes and small housing developments. Coverage includes full project delivery from groundworks to completion, coordination of trades, programme management and building regulations compliance. Winners demonstrate exceptional technical expertise, high build quality, safe working practices, and excellent customer satisfaction.',
    'Roofing Company':
      'This category recognises excellence in roofing services, including pitched and flat roofing, slate and tile work, roof repairs, replacements and restorations, chimney repairs, leadwork and rooflight window installation. Winners demonstrate exceptional technical expertise, safe working practices, relevant building regulations compliance, and excellent customer satisfaction.',
    'Structural Engineers':
      'This category recognises excellence in structural engineering services, including surveys, calculations and design, underpinning schemes, load-bearing alterations, subsidence assessment and reporting, and building control support. Winners demonstrate exceptional technical expertise, regulatory compliance and professional standards, and excellent customer satisfaction.',
    'Structural Steelworks':
      'This category recognises excellence in structural steel services, including design, fabrication and installation of steel beams, columns, lintels and frames for extensions, loft conversions, and load-bearing alterations, plus temporary works and lifting planning. Winners demonstrate exceptional technical expertise, safe working practices, relevant regulatory compliance, and excellent customer satisfaction.',
    // MECHANICAL, ELECTRICAL & PLUMBING
    'Air-Conditioning & Ventilation Company':
      'This category recognises excellence in climate control services, including air-conditioning installation, servicing and repairs, mechanical ventilation, heat recovery systems, commissioning and airflow balancing, and air quality solutions. Winners demonstrate exceptional technical expertise, safe working practices, relevant regulatory compliance, and excellent customer satisfaction.',
    'Electrical Company':
      'This category recognises excellence in electrical services, including installations, rewires, consumer unit upgrades, fault finding, testing and certification, and lighting design. Winners demonstrate exceptional technical expertise, safe working practices, relevant regulatory compliance, and excellent customer satisfaction.',
    'Heating Company':
      'This category recognises excellence in heating services, including boiler and cylinder installations, servicing and repairs, central heating systems, radiator upgrades, power flushing, unvented systems and smart heating controls. Winners demonstrate exceptional technical expertise, safe working practices, relevant regulatory compliance, and excellent customer satisfaction.',
    'Plumbing Company':
      'This category recognises excellence in plumbing services, including installations, repairs and maintenance, pipework, water systems, bathroom and kitchen plumbing, leak detection and emergency callouts. Winners demonstrate exceptional technical expertise, safe working practices, relevant regulatory compliance, and excellent customer satisfaction.',
    'Underfloor Heating Company':
      'This category recognises excellence in underfloor heating services, including design, supply and installation of electric and water-based systems, retrofit solutions, zoning controls, and system servicing and commissioning. Winners demonstrate exceptional technical expertise, safe working practices, relevant regulatory compliance, and excellent customer satisfaction.',
    // CARPENTRY & JOINERY
    'Cabinet Maker':
      'This category recognises excellence in bespoke cabinet making, including design and crafting of fitted and freestanding furniture, such as wardrobes, bookcases, media units and storage solutions, using traditional and contemporary techniques. Winners demonstrate exceptional craftsmanship and technical expertise, safe working practices, relevant regulatory compliance, and excellent customer satisfaction.',
    'Carpentry Company':
      'This category recognises excellence in carpentry services, including first and second fix carpentry, timber framing, stud partitions, flooring and joists, door hanging, skirting, architraves and bespoke site-built joinery. Winners demonstrate exceptional craftsmanship and technical expertise, safe working practices, relevant regulatory compliance, and excellent customer satisfaction.',
    'Joinery Company':
      'This category recognises excellence in joinery services, covering the design, workshop manufacture and installation of precision timber components, such as doorsets, windows, staircases, fitted furniture and architectural timber features. Winners demonstrate exceptional craftsmanship and technical expertise, safe working practices, relevant regulatory compliance, and excellent customer satisfaction.',
    'Staircase Specialist':
      'This category recognises excellence in staircase surveying, design, manufacture and installation, including straight, turning and spiral staircases, bespoke balustrades and handrails, upgrades and refurbishments, and mixed-material systems. Winners demonstrate outstanding accuracy, finish and installation quality, safe working practices, relevant regulatory compliance, and excellent customer satisfaction.',
    'Timber Windows Installer':
      'This category recognises excellence in timber window installation and renewal, including casement, sash and flush systems, repairs, restoration, draught-proofing and sympathetic upgrades to period joinery. Winners demonstrate high standards of surveying, fitting, weather-tightness and finishing, relevant regulatory compliance, safe working practices, and excellent customer satisfaction.',
    // FIT-OUT & FINISHING
    'Bathroom Installer':
      'This category recognises excellence in bathroom installation, including design, supply and fitting of suites, sanitaryware, waterproofing, tiling, plumbing, electrics (via appropriately qualified trades) and ventilation, plus wet rooms, ensuites and accessible bathroom adaptions. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Carpet Fitters':
      'This category recognises excellence in carpet fitting services, including measurement, supply and installation of carpets, underlay and gripper systems, stair runners, repairs and restretching. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Curtains & Blinds Installer':
      'This category recognises excellence in window dressing services, including measurement, supply and installation of curtains, blinds, shutters and motorised systems, plus tracks, poles and bespoke soft furnishings. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Drylining Company':
      'This category recognises excellence in drylining services, including plasterboard installation, metal and timber stud partitioning, insulated lining systems, acoustic solutions, fire-rated assemblies, plus taping and jointing. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Flooring Installer':
      'This category recognises excellence in flooring installation, including hardwood, engineered timber, laminate, LVT/LVP, plus subfloor preparation, moisture testing, repairs and restoration. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Home Office Installer':
      'This category recognises excellence in home office design and installation, including bespoke desks, fitted storage, shelving systems, cable management, lighting integration and ergonomic workspace configurations. Winners demonstrate exceptional technical expertise and fit standards, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Interior Refurbishment Company':
      'This category recognises excellence in interior refurbishment and fit-out projects, including layout reconfigurations, structural alterations, multi-trade coordination and project management. Winners demonstrate exceptional technical expertise, project management skills, effective compliance management, safe working practices, and excellent customer satisfaction.',
    'Kitchen Installer':
      'This category recognises excellence in kitchen installation, including design coordination, supply and fitting of units, worktops, appliances, plumbing and electrics (via appropriately qualified trades) and wall/floor finishing. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Painting & Decorating Company':
      'This category recognises excellence in painting and decorating services, including interior and exterior painting, wallpapering, specialist finishes, surface preparation, repairs and colour consultancy. Winners demonstrate exceptional technical expertise and finish quality, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Plastering Company':
      'This category recognises excellence in plastering services, including skimming, internal rendering, decorative mouldings and coving, and lime plastering for period properties. Winners demonstrate exceptional technical expertise and finish quality, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Screeding Company':
      'This category recognises excellence in screeding, including sand and cement screeds, liquid and flowing screeds, fast-drying compounds, underfloor heating preparation and floor levelling solutions. Winners demonstrate exceptional technical expertise and finish quality, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Tiling Installer':
      'This category recognises excellence in tile fitting, including wall and floor tiling, natural stone, porcelain, ceramic and mosaic installations, waterproofing, underfloor heating compatibility and intricate pattern work. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    // OUTDOOR & LANDSCAPING
    'Decking Company':
      'This category recognises excellence in the design, supply and installation of timber, composite and PVC decking. This includes balustrades, steps, pergolas, raised platforms and maintenance treatments. Winners demonstrate exceptional technical expertise and finish quality, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Driveway & Paving Company':
      'This category recognises excellence in driveway and paving laying, including block paving, resin-bound surfaces, tarmac, gravel, natural stone, patios, pathways and drainage solutions. Winners demonstrate exceptional technical expertise, durable finishes, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Fencing Installer':
      'This category recognises excellence in the installation of timber, metal and composite fencing, gates, trellis, acoustic barriers, security fencing and repairs. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Gardening Services':
      'This category recognises excellence in gardening and horticulture services, including lawn care, planting schemes, pruning, border cultivation, pest and disease management, and seasonal maintenance programmes. Winners demonstrate sound horticultural knowledge, appropriate compliance, safe working practices, and excellent customer satisfaction.',
    'Garden Outbuilding Company':
      'This category recognises excellence in the design, supply and installation of garden outbuildings, including summer houses, garden rooms, home offices, workshops, sheds and bespoke timber structures. Winners demonstrate high-quality craftsmanship, appropriate compliance, safe working practices, and excellent customer satisfaction.',
    'Landscaping & Garden Design Company':
      'This category recognises excellence in landscaping and garden design, including hard and soft landscaping, planting schemes, water features, terracing, retaining walls and full garden transformations. Winners demonstrate exceptional technical expertise, appropriate compliance and safe working practices, and excellent customer satisfaction.',
    'Outdoor Lighting & Electrical Company':
      'This category recognises excellence in exterior electrical services, including garden lighting design and installation, security lighting, festoon/feature lighting, outdoor power supplies and automation systems. Winners demonstrate exceptional technical expertise, regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Tree Surgery Services':
      'This category recognises excellence in arboriculture services, including tree felling, crown reduction, pruning, pollarding, stump grinding, hedge management and emergency storm response, delivered with environmental consideration. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    // ENERGY, TECH & SUSTAINABILITY
    'EV Charger Installer':
      'This category recognises excellence in electric vehicle charging services, including supply and installation of home chargers, load management, electrical upgrades, smart charging systems and OZEV-approved installations. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Insulation & Energy Efficiency Company':
      'This category recognises excellence in insulation and energy efficiency services, including loft, cavity wall, solid wall and floor insulation, draught-proofing, ventilation solutions and energy performance improvements. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'PV Installer':
      'This category recognises excellence in solar photovoltaic services, including design, supply and installation of solar panel systems, battery storage, inverters, monitoring systems and grid connection management. Winners demonstrate exceptional technical expertise, regulatory compliance and safe working practices, and excellent customer satisfaction.',
    'Renewable Energy Specialist':
      'This category recognises excellence in renewable energy services, including solar PV, battery storage, heat pumps, biomass systems and hybrid solutions, alongside energy assessments, system design and optimisation to reduce carbon emissions. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Security Systems Installer':
      'This category recognises excellence in security system installation services, including intruder alarms, CCTV, access control, video doorbells, monitoring options and integrated security solutions. Winners demonstrate exceptional technical expertise, regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Smart Home & Automation Company':
      'This category recognises excellence in smart home services, including design and installation of lighting control, heating automation, audio-visual systems, security integration, voice control and whole-home automation platforms. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    // SPECIALIST TRADES
    'Asbestos Removal Specialist':
      'This category recognises excellence in asbestos services, including surveys and sampling, encapsulation, safe removal and disposal of asbestos-containing materials, air monitoring and clearance support through to certification, delivered in line with HSE requirements. Winners demonstrate exceptional technical expertise, regulatory compliance, exemplary safe working practices, and excellent customer satisfaction.',
    Locksmith:
      'This category recognises excellence in locksmith services, including lock installation, repairs and upgrades, emergency access, key cutting, security assessments, security safe work and smart lock integration. Winners demonstrate exceptional technical expertise, safe working practices, and excellent customer satisfaction.',
    'Pest Control Company':
      'This category recognises excellence in pest control services, including prevention, treatment and eradication of rodents, insects and selected wildlife issues, proofing works, hygiene advice, and ongoing monitoring programmes. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Rendering Company':
      'This category recognises excellence in rendering services, including traditional sand/cement render, monocouche, silicone and acrylic systems, coloured renders, textured finishes and external wall insulation render coatings. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Scaffolding Company':
      'This category recognises excellence in scaffolding and access solutions, including design, erection and dismantling of scaffolding, tower scaffolds, temporary roofs and safe access solutions for construction and maintenance. Winners demonstrate exceptional technical expertise, regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Shop Fitting Company':
      'This category recognises excellence in shopfitting services, including design, manufacture and installation of retail interiors, display systems, counters, shelving, lighting and bespoke joinery for commercial premises. Winners demonstrate exceptional technical expertise and programme control, regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Swimming Pool & Hot Tub Company':
      'This category recognises excellence in pool and spa services, including design, installation, maintenance and repairs of swimming pools, hot tubs and swim spas, plus covers, heating, filtration and water treatment solutions. Winners demonstrate exceptional technical expertise, regulatory compliance, safe working practices, and excellent customer satisfaction.',
    'Window & Door Installer':
      'This category recognises excellence in window and door services, including supply and installation of uPVC and aluminium windows, entrance doors, bifold and sliding doors, roof lanterns and conservatory replacements. Winners demonstrate exceptional technical expertise, regulatory compliance, safe working practices, and excellent customer satisfaction.',
    // COMBINED categories (small regions)
    'Plumbing & Heating Company':
      'This category recognises excellence in plumbing and heating services, including system design, installation, servicing, and repair of boilers, cylinders, central heating systems, radiators, pipework, and water systems; plus bathroom and kitchen plumbing, diagnostics, and emergency response. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance and safe working practices, and excellent customer satisfaction.',
    'Carpentry & Joinery Company':
      'This category recognises excellence in carpentry and joinery, encompassing design, precision workshop manufacture, installation of timber components and features, including staircases, doorsets, fitted furniture, flooring systems, wall partitions, architectural features, and bespoke joinery. Winners demonstrate exceptional craftsmanship and technical expertise, appropriate regulatory compliance, safe working practices, and excellent customer satisfaction.',
    // INDUSTRY LEADERSHIP
    'Apprentice of the Year':
      'This category recognises outstanding performance by an apprentice working within the construction and building services sector, including technical skill development, professional attitude, work ethic, progress toward training and qualifications, contribution to workplace projects, and commitment to continuous learning. Winners demonstrate strong engagement with their training provider, safe working practices, and excellent employer and mentor satisfaction.',
    'Lifetime Achievement Award':
      'This category recognises exceptional career achievement and lasting contribution to the British construction and building services sector, including decades of mentorship of apprentices and young tradespeople, industry leadership, advancement of trade best practices, and unwavering commitment to raising quality standards across the sector. Winners demonstrate unparalleled technical expertise throughout their career, consistent adherence to regulatory standards, exemplary safe working practices, and exceptional customer satisfaction over a sustained period.',
    'Community Impact Award':
      'This category recognises a tradesperson or business making a meaningful difference in the local community. Attributes include support for local causes, charities and community initiatives; delivery of social value through employment, apprenticeships, mentoring or volunteering; contribution to community wellbeing; and a clear commitment to improving the lives of customers, neighbourhoods and the wider public. Winners demonstrate genuine community leadership, measurable positive outcomes, a strong local reputation, exemplary professional standards, and excellent customer satisfaction.',
    'Female Tradesperson of the Year':
      'This category recognises outstanding achievement by a woman working in the British construction and building services sector. Attributes include exceptional technical skill and craftsmanship, professional attitude and work ethic, contribution to workplace projects, commitment to continuous professional development, and dedication to advancing female participation in the industry. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, exemplary safe working practices, strong industry presence, and excellent customer satisfaction.',
    'Male Tradesperson of the Year':
      'This category recognises outstanding achievement by a man working in the British construction and building services sector. Attributes include exceptional technical skill and craftsmanship, professional attitude and work ethic, contribution to workplace projects, and commitment to continuous professional development. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, exemplary safe working practices, and excellent customer satisfaction.',
    'New Business of the Year':
      'This category recognises outstanding achievement by a newly established business (operating no more than 3 years) within the British construction and building services sector. Attributes include strong business growth and sustainability, innovative approach to service delivery, effective financial management and operational efficiency, and commitment to quality standards. Winners demonstrate exceptional technical expertise, appropriate regulatory compliance, exemplary safe working practices, and excellent customer satisfaction.',
  };

  /* ─────────────────────────────────────────────
     6. EXPORT
  ───────────────────────────────────────────── */
  window.BTA_HOME_DATA = {
    sectorCategories: SECTOR_CATEGORIES,
    sectorMeta: SECTOR_META,
    regionData: REGION_DATA,
    flagMap: FLAG_MAP,
    categoryDescriptions: CATEGORY_DESCRIPTIONS,
  };

  // Backward-compatibility aliases expected by submit-entry.js, nominate.js, config.js
  window.REGION_DATA = REGION_DATA;
  window.LONDON_BOROUGHS = [
    'Bromley',
    'Camden',
    'Croydon',
    'Greenwich',
    'Hackney',
    'Hammersmith & Fulham',
    'Islington',
    'Kensington & Chelsea',
    'Kingston & Richmond',
    'Lambeth',
    'Lewisham',
    'Middlesex',
    'Southwark',
    'Westminster',
    'Wandsworth',
  ];
  window.SECTORS = Object.keys(SECTOR_CATEGORIES);
  window.STANDARD_CATEGORIES = SECTOR_CATEGORIES;
})();
