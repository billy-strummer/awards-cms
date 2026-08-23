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
      'Structural Engineering Company',
      'Structural Steelworks Company',
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
      'Timber Window Installer',
    ],
    'FIT-OUT & FINISHING': [
      'Bathroom Installer',
      'Carpet Fitter',
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
      'Tradeswoman of the Year',
      'Tradesman of the Year',
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
    'Conwy & Denbighshire': 'Conwy & Denbighshire.png',
    'Gwynedd & Anglesey': 'Gwynedd.png',
    Carmarthenshire: 'Carmarthenshire.png',
    // Scotland (Edinburgh & Glasgow have individual flags; all others use Scotland.png)
    Edinburgh: 'Edinburgh.png',
    Glasgow: 'Glasgow.png',
    Stirling: 'Scotland.png',
    Falkirk: 'Scotland.png',
    Clackmannanshire: 'Scotland.png',
    Lanarkshire: 'Scotland.png',
    Dunbartonshire: 'Scotland.png',
    Inverness: 'Scotland.png',
    'Fort William': 'Scotland.png',
    Elgin: 'Scotland.png',
    Aviemore: 'Scotland.png',
    Wick: 'Scotland.png',
    Aberdeen: 'Scotland.png',
    Fraserburgh: 'Scotland.png',
    Peterhead: 'Scotland.png',
    Inverurie: 'Scotland.png',
    Dundee: 'Scotland.png',
    Perth: 'Scotland.png',
    Arbroath: 'Scotland.png',
    Kirriemuir: 'Scotland.png',
    'St Andrews': 'Scotland.png',
    Dunfermline: 'Scotland.png',
    Kirkcaldy: 'Scotland.png',
    Glenrothes: 'Scotland.png',
    Livingston: 'Scotland.png',
    Haddington: 'Scotland.png',
    Linlithgow: 'Scotland.png',
    Paisley: 'Scotland.png',
    Ayr: 'Scotland.png',
    Kilmarnock: 'Scotland.png',
    Hamilton: 'Scotland.png',
    Greenock: 'Scotland.png',
    Ayrshire: 'Scotland.png',
    Renfrewshire: 'Scotland.png',
    'Argyll & Bute': 'Scotland.png',
    Galashiels: 'Scotland.png',
    Hawick: 'Scotland.png',
    Jedburgh: 'Scotland.png',
    Peebles: 'Scotland.png',
    'Scottish Borders': 'Scotland.png',
    // Scotland region-level names (used by updated REGION_DATA)
    'Central Scotland': 'Scotland.png',
    'Dumfries & Galloway': 'Scotland.png',
    Fife: 'Scotland.png',
    Grampian: 'Scotland.png',
    Highlands: 'Scotland.png',
    Lothian: 'Scotland.png',
    'Scottish Islands': 'Scotland.png',
    Tayside: 'Scotland.png',
    Dumfries: 'Scotland.png',
    Stranraer: 'Scotland.png',
    'Newton Stewart': 'Scotland.png',
    Kirkcudbright: 'Scotland.png',
    Skye: 'Scotland.png',
    Orkney: 'Scotland.png',
    Shetland: 'Scotland.png',
    Lewis: 'Scotland.png',
    Arran: 'Scotland.png',
    // English cities without individual flags → England.png placeholder
    Gateshead: 'BTA_Corporate_Horizontal-gold-white.png',
    Sunderland: 'BTA_Corporate_Horizontal-gold-white.png',
    Bradford: 'BTA_Corporate_Horizontal-gold-white.png',
    York: 'BTA_Corporate_Horizontal-gold-white.png',
    Hull: 'BTA_Corporate_Horizontal-gold-white.png',
    Reading: 'England.png',
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
      'This category recognises excellence in brick, block and stonework services, including new walls, extensions and new builds, repointing, chimney work, and heritage restoration.',
    'Drainage Company':
      'This category recognises excellence in foul and surface water drainage services, including installations, repairs, drain relining, excavations, soakaways, septic tank maintenance, high-pressure jetting, blocked drain clearance, and CCTV drain mapping.',
    'Extension Company':
      'This category recognises excellence in delivering extension projects, including single- and multi-storey additions, side-return extensions, wraparounds, garage conversions, structural alterations, and full project management.',
    'General Building Company':
      'This category recognises excellence in comprehensive building services, including renovations, extensions, loft conversions, structural alterations, and general repairs.',
    'Groundworks & Foundations Company':
      'This category recognises excellence in groundworks and foundation services, including excavations, concrete foundations, underpinning, retaining structures, piling, drainage installation, and site clearance.',
    'Guttering Company':
      'This category recognises excellence in roofline and rainwater management services, including the installation, repair and replacement of gutters, downpipes, fascias, soffits, bargeboards and cladding, alongside gutter cleaning, maintenance programmes and rainwater system upgrades.',
    'Loft Conversion Company':
      'This category recognises excellence in loft conversion services, including dormer, hip-to-gable, mansard and rooflight conversions, alongside structural strengthening, fire safety upgrades, custom staircase installations, and building regulations management.',
    'Maintenance Services':
      'This category recognises excellence in property maintenance services, including planned maintenance programmes, reactive repairs, facilities management, end-of-tenancy repairs, handyman services, minor building works, and seasonal property care.',
    'New Build Company':
      'This category recognises excellence in the construction of new-build residential properties, including bespoke homes and small developments, alongside complete project management from groundworks to completion, trade coordination, and building regulations compliance.',
    'Roofing Company':
      'This category recognises excellence in roofing services, including pitched and flat roofing, slate and tile work, roof repairs, replacements and restorations, chimney repairs, leadwork, and rooflight window installation.',
    'Structural Engineering Company':
      'This category recognises excellence in structural engineering services, including surveys, calculations and design, underpinning schemes, load-bearing alterations, subsidence assessment and reporting, and building control support.',
    'Structural Steelworks Company':
      'This category recognises excellence in structural steel services, including the design, fabrication, and installation of steel beams, columns, lintels, and frames for extensions, loft conversions, and load-bearing alterations, alongside temporary works and lifting planning.',
    // MECHANICAL, ELECTRICAL & PLUMBING
    'Air-Conditioning & Ventilation Company':
      'This category recognises excellence in HVAC and climate control services, including air-conditioning installation, servicing and repairs, mechanical ventilation, ductwork, heat recovery systems, commissioning and airflow balancing, and air quality solutions.',
    'Electrical Company':
      'This category recognises excellence in electrical services, including installations, rewires, consumer unit upgrades, fault finding, testing and certification, and lighting design.',
    'Heating Company':
      'This category recognises excellence in heating services, including boiler and cylinder installations, servicing and repairs, central heating systems, underfloor heating, radiator upgrades, power flushing, unvented systems, smart heating controls, and gas safety inspections.',
    'Plumbing Company':
      'This category recognises excellence in plumbing services, including installations, repairs and maintenance, pipework, hot and cold water systems, bathroom and kitchen plumbing, leak detection, and emergency callouts.',
    'Underfloor Heating Company':
      'This category recognises excellence in underfloor heating services, including the design, supply, and installation of electric and water-based systems, retrofit solutions, zoning controls, and system servicing and commissioning.',
    // CARPENTRY & JOINERY
    'Cabinet Maker':
      'This category recognises excellence in bespoke cabinet making, including the design and crafting of fitted and freestanding furniture, such as wardrobes, bookcases, media units, and storage solutions, using traditional and contemporary techniques.',
    'Carpentry Company':
      'This category recognises excellence in carpentry services, including first and second fix carpentry, timber framing, stud partitions, flooring and joists, door hanging, skirting, architraves, and bespoke site-built joinery.',
    'Joinery Company':
      'This category recognises excellence in joinery services, including the design, workshop manufacture, and installation of precision timber components, such as doorsets, windows, staircases, fitted furniture, and architectural timber features.',
    'Staircase Specialist':
      'This category recognises excellence in staircase surveying, design, manufacture, and installation, including straight, turning, and spiral staircases, bespoke balustrades and handrails, upgrades and refurbishments, and mixed-material systems.',
    'Timber Window Installer':
      'This category recognises excellence in timber window installation and renewal, including casement, sash, and flush systems, repairs, restoration, draught-proofing, conservation work, and sympathetic upgrades to period joinery.',
    // FIT-OUT & FINISHING
    'Bathroom Installer':
      'This category recognises excellence in bathroom installation, including the design, supply, and fitting of suites, sanitaryware, waterproofing, tiling, ventilation, certified plumbing and electrical work, alongside wet rooms, ensuites, and accessible adaptations.',
    'Carpet Fitter':
      'This category recognises excellence in carpet fitting services, including the measurement, supply, and installation of broadloom carpets and carpet tiles, alongside underlay and gripper systems, stair runners, subfloor preparation, repairs, and restretching.',
    'Curtains & Blinds Installer':
      'This category recognises excellence in window dressing services, including the measurement, supply, and installation of curtains, blinds, shutters, and motorised systems, alongside tracks, poles, and bespoke soft furnishings.',
    'Drylining Company':
      'This category recognises excellence in drylining services, including plasterboard installation, metal and timber stud partitioning, insulated lining systems, acoustic solutions, fire-rated assemblies, alongside taping and jointing.',
    'Flooring Installer':
      'This category recognises excellence in flooring installation, including hardwood, engineered timber, laminate, LVT/LVP, alongside subfloor preparation, moisture testing, repairs, and restoration.',
    'Home Office Installer':
      'This category recognises excellence in home office design and installation, including bespoke desks, fitted storage, shelving systems, cable management, lighting integration, and ergonomic workspace configurations.',
    'Interior Refurbishment Company':
      'This category recognises excellence in domestic and commercial interior refurbishment and fit-out projects, including layout reconfigurations, structural alterations, multi-trade coordination, and project management.',
    'Kitchen Installer':
      'This category recognises excellence in kitchen installation, including design coordination, the supply and fitting of units, worktops, and appliances, certified plumbing and electrical work, and wall and floor finishing.',
    'Painting & Decorating Company':
      'This category recognises excellence in painting and decorating services, including interior and exterior painting, wallpapering, specialist finishes, surface preparation, repairs, and colour consultancy.',
    'Plastering Company':
      'This category recognises excellence in plastering services, including drylining, skimming, internal rendering, decorative mouldings and coving, and lime plastering for period properties.',
    'Screeding Company':
      'This category recognises excellence in screeding, including sand and cement screeds, liquid and flowing screeds, fast-drying compounds, underfloor heating preparation, and floor levelling solutions.',
    'Tiling Installer':
      'This category recognises excellence in tile installation, including wall and floor tiling, natural stone, porcelain, ceramic and mosaic installations, wet room tanking, underfloor heating integration, and intricate pattern work.',
    // OUTDOOR & LANDSCAPING
    'Decking Company':
      'This category recognises excellence in the design, supply, and installation of timber, composite, and PVC decking, including balustrades, steps, pergolas, raised platforms, and maintenance treatments.',
    'Driveway & Paving Company':
      'This category recognises excellence in the installation of driveways and paving, including block paving, resin-bound surfaces, tarmac, gravel, natural stone, patios, pathways, and drainage solutions.',
    'Fencing Installer':
      'This category recognises excellence in the supply, installation, and repair of timber, metal, and composite fencing, including gates, trellises, acoustic barriers, and security fencing.',
    'Gardening Services':
      'This category recognises excellence in gardening and horticulture services, including lawn care, planting schemes, pruning, border cultivation, pest and disease management, hedge maintenance, and seasonal maintenance programmes.',
    'Garden Outbuilding Company':
      'This category recognises excellence in the design, supply, and installation of garden outbuildings, including summer houses, fully insulated garden rooms, home offices, workshops, sheds, and bespoke timber structures.',
    'Landscaping & Garden Design Company':
      'This category recognises excellence in landscaping and garden design, including spatial planning, hard and soft landscaping, planting schemes, water features, decking and terracing, retaining walls, and full garden transformations.',
    'Outdoor Lighting & Electrical Company':
      'This category recognises excellence in exterior electrical services, including garden lighting design and installation, security lighting, architectural and feature lighting, weatherproof outdoor power supplies, and smart automation systems.',
    'Tree Surgery Services':
      'This category recognises excellence in arboriculture services, including tree felling, crown reduction, pruning, pollarding, stump grinding, site clearance, and emergency storm response, all delivered with environmental consideration.',
    // ENERGY, TECH & SUSTAINABILITY
    'EV Charger Installer':
      'This category recognises excellence in electric vehicle charging services, including the supply and installation of home and workplace chargers, load management, electrical upgrades, smart charging systems, and OZEV-approved installations.',
    'Insulation & Energy Efficiency Company':
      'This category recognises excellence in insulation and energy efficiency services, including loft, cavity wall, solid wall, and floor insulation, draught-proofing, ventilation solutions, and whole-building energy retrofits.',
    'PV Installer':
      'This category recognises excellence in solar photovoltaic services, including the design, supply, and installation of MCS-certified solar panel systems, battery storage, inverters, monitoring systems, and grid connection management.',
    'Renewable Energy Specialist':
      'This category recognises excellence in renewable energy services, including solar PV, battery storage, air and ground source heat pumps, biomass systems, and hybrid solutions, alongside energy assessments, system design, and optimisation to reduce carbon emissions.',
    'Security Systems Installer':
      'This category recognises excellence in security system installation services, including intruder alarms, CCTV, access control, video doorbells, monitoring options, and integrated security solutions.',
    'Smart Home & Automation Company':
      'This category recognises excellence in smart home services, including the design and installation of robust home networking, lighting control, heating automation, audio-visual systems, security integration, voice control, and whole-home automation platforms.',
    // SPECIALIST TRADES
    'Asbestos Removal Specialist':
      'This category recognises excellence in asbestos management and removal services, including surveys and sampling, encapsulation, the safe removal and disposal of asbestos-containing materials, air monitoring, and clearance certification, all delivered in strict accordance with HSE regulations.',
    Locksmith:
      'This category recognises excellence in locksmith services, including lock installation, repairs and upgrades, emergency access, uPVC and multi-point lock repairs, key cutting, security assessments, safe opening, and smart lock and access control integration.',
    'Pest Control Company':
      'This category recognises excellence in pest control services, including the prevention, treatment, and eradication of rodents, insects, and selected wildlife issues, alongside proofing works, hygiene advice, and ongoing monitoring programmes.',
    'Rendering Company':
      'This category recognises excellence in rendering services, including traditional sand and cement renders, monocouche, silicone and acrylic systems, coloured and textured finishes, and external wall insulation (EWI) systems.',
    'Scaffolding Company':
      'This category recognises excellence in scaffolding and access services, including the bespoke design, erection, and dismantling of scaffolding, tower scaffolds, temporary roofs, edge protection, and safe access solutions for construction and maintenance.',
    'Shop Fitting Company':
      'This category recognises excellence in shopfitting services, including the design, manufacture, and installation of retail and hospitality interiors, display systems, counters, shelving, lighting, and bespoke joinery for commercial premises.',
    'Swimming Pool & Hot Tub Company':
      'This category recognises excellence in pool and spa services, including the design, installation, maintenance, and repair of swimming pools, hot tubs, and swim spas, alongside covers, plant room systems, heating, filtration, and water treatment solutions.',
    'Window & Door Installer':
      'This category recognises excellence in window and door services, including the supply and installation of uPVC, aluminium, and timber windows, composite entrance doors, bifold and sliding doors, roof lanterns, and conservatory replacements, delivered to FENSA or CERTASS standards.',
    // COMBINED categories (small regions)
    'Plumbing & Heating Company':
      'This category recognises excellence in plumbing and heating services, including system design, installation, servicing, and repair of boilers, unvented cylinders, central heating systems, radiators, pipework, and water systems, alongside bathroom and kitchen plumbing, diagnostics, and Gas Safe registered emergency response.',
    'Carpentry & Joinery Company':
      'This category recognises excellence in carpentry and joinery, encompassing first and second fix site carpentry alongside precision workshop manufacture, including staircases, doorsets, fitted furniture, flooring systems, wall partitions, architectural features, and bespoke joinery.',
    // INDUSTRY LEADERSHIP
    'Apprentice of the Year':
      'This category recognises outstanding performance by an apprentice within the construction and building services sectors, encompassing technical skill development, a strong balance of on-the-job application and training provider progress, impeccable safe working practices, and glowing mentor feedback.',
    'Lifetime Achievement Award':
      'This category recognises an exceptional career and lasting legacy within the British construction and building services sector, encompassing decades of mentoring young tradespeople, unparalleled technical expertise, industry leadership, and an unwavering commitment to raising standards and championing best practice.',
    'Community Impact Award':
      'This category recognises a tradesperson or business making a meaningful difference in their local community, encompassing the delivery of social value through apprenticeships and mentoring, dedicated support for local charities, genuine community leadership, and a proven commitment to improving local neighbourhoods.',
    'Tradeswoman of the Year':
      'This category recognises outstanding achievement by a woman in the British construction and building services sector, encompassing exceptional craftsmanship, exemplary safe working practices, continuous professional development, and a dedication to advancing female participation in the industry.',
    'Tradesman of the Year':
      'This category recognises outstanding achievement by a man in the British construction and building services sector, encompassing exceptional technical craftsmanship, a professional work ethic, continuous professional development, exemplary safe working practices, and outstanding customer satisfaction.',
    'New Business of the Year':
      'This category recognises outstanding achievement by a newly established business (trading for three years or less) within the British construction and building services sector, encompassing strong commercial growth, effective financial management, innovative service delivery, and exemplary standards of safety and customer satisfaction.',
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
