// Pyinsect 2.8 EAB Oregon "damage_girdler" (Oct 27 2026, 267 classes): model files, how photos are prepared for it,
// its classes (in output order) and the species that get reported. Matches "Pyinsect model executor Oregon v8.1.py"
// with "Pyinsect 2.8_EAB_Oregon_2026-10-27_damage_girdler.pth". New since the "crop" model: damage photos of other
// insects are their own classes (names end in _damage, plus lymantria_dispar_egg_mass), and Rose Stem Girdler
// (agrilus_cuprescens, an EAB look-alike) was added. Rose Stem Girdler is NOT invasive, so it's not in `invasive`.
// Keep `invasive` in sync with INVASIVE in relay/worker.js. Emerald ash borer damage isn't here on purpose:
// it's a sick tree, not a bug, so it gets an "Infested tree" report instead (damageClass in assets/trees/ash.js).
window.PYINSECT_MODEL = {
  name: "Pyinsect 2.8 Oregon",
  url: new URL("../../model/insect_model_2.8_oregon_damage_girdler.onnx", document.currentScript.src).href,
  size: 24203904,
  resize: "crop",       // resize 256 + centre crop 224, like the executor's TRANSFORM
  scientific: true,     // class names are scientific names (show common + scientific)
  minConfidence: 50,    // below this % the answer is "Unable to determine"
  otherClass: "other_insect",   // if the model picks this, the answer is "Insect not in my list"
  // The model file also gives "sim": how close the photo is to the nearest known insect
  // (the .notinlist.pt fingerprints). Below this it's "Insect not in my list" (keeps 95% of real photos).
  notInListCutoff: 0.4971562325954437,
  // Small photos (shorter side under smallPx) use a copy of the model trained on low-resolution photos.
  // It's only downloaded when a small photo comes along.
  lowres: {
    url: new URL("../../model/insect_model_2.8_oregon_damage_girdler_lowres.onnx", document.currentScript.src).href,
    size: 17390141,
    smallPx: 200,
  },
  classes: [
    "achroia_grisella", "adalia_bipunctata", "agapostemon_femoratus", "agapostemon_texanus", "agapostemon_virescens",
    "aglais_milberti", "agonum_muelleri", "agrilus_anxius_politus", "agrilus_anxius_politus_damage",
    "agrilus_cuprescens", "agrilus_planipennis", "agrilus_planipennis_damage", "agrotis_ipsilon", "amara_apricaria",
    "ammophila_procera", "anisandrus_dispar", "anopheles_freeborni", "anoplophora_glabripennis", "anthaxia_prasina",
    "antheraea_polyphemus", "anthocharis_sara", "anthophora_urbana", "anthrenus_scrophulariae", "anthrenus_verbasci",
    "apantesis_ornata", "aphodius_fimetarius", "apis_mellifera", "argynnis_cybele", "argynnis_hydaspe_zerene",
    "atlides_halesus", "attagenus_unicolor", "autographa_californica", "banasa_dimidiata",
    "bark_beetle_damage_other", "battus_philenor", "bembix_americana", "biston_betularia", "blatta_orientalis",
    "blattella_germanica", "boloria_epithore", "bombus", "buprestis_adjecta_intricata", "buprestis_aurulenta",
    "buprestis_langii", "buprestis_subornata", "burnsius_communis", "calliphora_vicina", "callophrys_augustinus",
    "callophrys_gryneus", "calosoma_cancellatum", "carabus_granulatus", "carabus_nemoralis", "catocala_ilia",
    "catocala_relicta", "catocala_unijuga", "cecropterus_pylades", "celastrina_echo", "ceratina_acantha",
    "cercyonis_pegala", "cercyonis_sthenele", "chalybion_californicum", "chilocorus_stigma", "chinavia_hilaris",
    "chlaenius_sericeus", "chloridea_virescens", "chrysis_fuscipennis", "chrysobothris_cyanella",
    "chrysobothris_viridicyanea", "chrysodeixis_includens", "cicindela_oregona_repanda_tranquebarica",
    "cicindelidia_hemorrhagica", "cimex_lectularius", "coccinella_septempunctata", "coccinella_trifasciata",
    "colias_eurytheme_philodice", "coptotermes_formosanus", "cotinis_mutabilis", "crambus_praefectellus",
    "culex_pipiens_tarsalis", "cycloneda_polita", "cydalima_perspectalis", "cydia_pomonella", "danaus_gilippus",
    "danaus_plexippus", "dasymutilla_occidentalis", "dasymutilla_sackenii", "dendroctonus_brevicomis",
    "dendroctonus_ponderosae_rufipennis", "dendroctonus_ponderosae_rufipennis_damage", "dermestes_lardarius",
    "dermestes_maculatus", "dichelonyx_backii", "dolichovespula_arenaria", "dolichovespula_maculata",
    "draeculacephala_crassicornis", "drosophila_melanogaster_suzukii", "dryocoetes_autographus",
    "elaphrus_purpurans", "ennomos_magnaria", "epargyreus_clarus", "ephestia_kuehniella", "erynnis_propertius",
    "estigmene_acrea", "euchloe_ausonides", "euphydryas_chalcedona", "everes_comyntas", "exochomus_quadripustulatus",
    "exomala_orientalis", "galleria_mellonella", "gastrophysa_cyanea", "halictus_ligatus", "halyomorpha_halys",
    "harmonia_axyridis", "harpalus_affinis", "harpalus_pensylvanicus", "helicoverpa_zea", "hemaris_thetis",
    "hippodamia_convergens", "hippodamia_tredecimpunctata", "hofmannophila_pseudospretella", "hyalophora_euryalus",
    "hylephila_phyleus", "hyles_lineata", "hylobius_warreni", "hyphantria_cunea", "icaricia_icarioides",
    "incisitermes_minor", "ips_pini", "ips_typographus", "ips_typographus_damage", "lacanobia_subjuncta",
    "lambdina_fiscellaria", "lasioderma_serricorne", "lasioglossum_zephyrus", "lebia_viridis", "limenitis_archippus",
    "limenitis_lorquini", "lucilia_sericata", "lycorma_delicatula", "lymantria_dispar", "lymantria_dispar_egg_mass",
    "lymantria_monacha", "lytta_cyanipennis", "malacosoma_californica_disstria", "mamestra_configurata",
    "manduca_quinquemaculatus_sexta", "mantis_religiosa", "megachile_rotundata", "mischocyttarus_flavitarsis",
    "musca_domestica", "nebria_brevicollis", "neophasia_menapia", "nepytia_phantasmaria",
    "nitidolimonius_resplendens", "noctua_pronuba", "nomia_melanderi", "nymphalis_antiopa", "nymphalis_californica",
    "ochlodes_sylvanoides", "oeneis_nevadensis", "omus_californicus", "omus_dejeanii", "onthophagus_taurus",
    "operophtera_brumata", "orgyia_pseudotsugata_vetusta", "orthotomicus_caelatus", "oryzaephilus_surinamensis",
    "osmia_cornifrons", "osmia_lignaria", "other_insect", "otiorhynchus_ovatus", "otiorhynchus_sulcatus",
    "pachysphinx_occidentalis", "paonias_myops", "papilio_eurymedon", "papilio_polyxenes_zelicaon",
    "papilio_rutulus", "pennisetia_marginatum", "pepsis_thisbe", "peridroma_saucia", "periplaneta_americana",
    "phaenops_gentilis", "philanthus_gibbosus", "photinus_californicus", "phryganidia_californica",
    "phyciodes_cocyta", "phyciodes_mylitta", "pieris_rapae", "pissodes_strobi", "pissodes_strobi_damage",
    "platycerus_oregonensis", "platypedia_areolata", "plebejus_melissa", "plodia_interpunctella",
    "plutella_xylostella", "polistes_aurifer", "polistes_dominula", "polistes_metricus", "polites_peckius",
    "polydrusus_impressifrons", "polygonia_satyrus", "polygraphus_rufipennis", "polyphylla_crinita_decemlineata",
    "pontia_protodice", "popillia_japonica", "prionoxystus_robiniae", "promecognathus_laevissimus",
    "propylea_quatuordecimpunctata", "pseudaletia_unipuncta", "pseudogaurotina_cressoni",
    "psyllobora_vigintimaculata", "pterostichus_lama", "pterostichus_melanarius", "pyrrharctia_isabella",
    "reticulitermes_hesperus", "rhyzopertha_dominica", "sabulodes_aegrotata", "satyrium_saepium",
    "scaphinotus_interruptus", "scarites_subterraneus", "sceliphron_caementarium", "scolytus_multistriatus",
    "scolytus_multistriatus_damage", "scolytus_ventralis_damage", "sinodendron_rugosum",
    "sitophilus_granarius_oryzae", "sphinx_chersis", "sphinx_perelegans", "spilosoma_virginica", "spodoptera_exigua",
    "spodoptera_frugiperda", "spodoptera_ornithogalli", "stagmomantis_limbata", "stegobium_paniceum",
    "stomoxys_calcitrans", "strymon_melinus", "supella_longipalpa", "synanthedon_exitiosa", "tabanus_punctifer",
    "temnoscheila_chlorodia", "tenebrio_molitor_obscurus", "tenodera_sinensis", "tent_web_damage", "termite_damage",
    "tharsalea_helloides", "tharsalea_heteronea", "tinea_pellionella", "tineola_bisselliella", "trachykele_blondeli",
    "tribolium_castaneum", "trichoplusia_ni", "trogoderma_variabile", "trypodendron_lineatum", "tyria_jacobaeae",
    "udea_profundalis", "vanessa_annabella", "vanessa_atalanta", "vanessa_cardui", "vanessa_virginiensis",
    "vespa_mandarinia", "vespula_germanica_pensylvanica", "xenoglossa_pruinosa", "xyleborus_monographus",
    "xylocopa_sonorina", "xylocopa_virginica", "zale_lunata", "zootermopsis_angusticollis"
  ],
  invasive: [
    "agrilus_planipennis", "anisandrus_dispar",
    "anoplophora_glabripennis", "coptotermes_formosanus", "cydalima_perspectalis",
    "drosophila_melanogaster_suzukii", "exomala_orientalis", "halyomorpha_halys",
    "ips_typographus", "lycorma_delicatula", "lymantria_dispar", "lymantria_monacha",
    "operophtera_brumata", "polistes_dominula", "popillia_japonica", "scolytus_multistriatus",
    "vespa_mandarinia", "xyleborus_monographus",
    // signs of invasive species: their galleries and egg masses
    "scolytus_multistriatus_damage", "ips_typographus_damage", "lymantria_dispar_egg_mass"
  ],
};
