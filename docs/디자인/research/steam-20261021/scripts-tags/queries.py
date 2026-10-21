# -*- coding: utf-8 -*-
"""Tag query plan for the Steam life-sim universe (2026-10-21).

layer:
  U1  core life tags, every game carrying the tag is included (wholesale union)
  U2  adjacent: a broad/animal/build tag only in intersection with an anchor tag
      (Simulation 599 or Relaxing 1654), or a small special-purpose tag
  L   language / education tags (separate list, threshold 100 reviews)
  L2  education-adjacent small tags (Typing, Trivia), kept but flagged
  X   classification-only intersections that are subsets of U1 (crawled so the
      source-query field can show them; they add no new games)
"""

QUERIES = [
    # ---- U1 core (wholesale)
    ('lifesim', '10235', 'U1', 'Life Sim'),
    ('cozy', '97376', 'U1', 'Cozy'),
    ('farmingsim', '87918', 'U1', 'Farming Sim'),
    ('farming', '4520', 'U1', 'Farming'),
    ('agriculture', '22602', 'U1', 'Agriculture'),
    ('wholesome', '552282', 'U1', 'Wholesome'),
    ('colonysim', '220585', 'U1', 'Colony Sim'),
    ('datingsim', '9551', 'U1', 'Dating Sim'),
    ('shopkeeper', '91114', 'U1', 'Shop Keeper'),
    ('hobbysim', '1220528', 'U1', 'Hobby Sim'),
    ('decorating', '889937', 'U1', 'Decorating'),
    ('organizing', '1239876', 'U1', 'Organizing'),
    ('cleaning', '23491', 'U1', 'Cleaning'),
    ('fishing', '15564', 'U1', 'Fishing'),
    ('cooking', '3920', 'U1', 'Cooking'),
    ('jobsim', '35079', 'U1', 'Job Simulator'),
    ('desktopcompanion', '1320952', 'U1', 'Desktop Companion'),
    # ---- U2 adjacent (intersection with anchor, or small special tag)
    ('cats_sim', '17894,599', 'U2', 'Cats AND Simulation'),
    ('dogs_sim', '1637,599', 'U2', 'Dogs AND Simulation'),
    ('animals_sim', '9626,599', 'U2', 'Animals AND Simulation'),
    ('horses_sim', '6041,599', 'U2', 'Horses AND Simulation'),
    ('birds_sim', '6214,599', 'U2', 'Birds AND Simulation'),
    ('foxes_sim', '507423,599', 'U2', 'Foxes AND Simulation'),
    ('capybaras_sim', '1352486,599', 'U2', 'Capybaras AND Simulation'),
    ('wolves_sim', '20486,599', 'U2', 'Wolves AND Simulation'),
    ('zoo_sim', '46348,599', 'U2', 'Zoo AND Simulation'),
    ('creature_sim', '916648,599', 'U2', 'Creature Collector AND Simulation'),
    ('citybuilder_relax', '4328,1654', 'U2', 'City Builder AND Relaxing'),
    ('building_relax', '1643,1654', 'U2', 'Building AND Relaxing'),
    ('basebuilding_relax', '7332,1654', 'U2', 'Base Building AND Relaxing'),
    ('crafting_relax', '1702,1654', 'U2', 'Crafting AND Relaxing'),
    ('sandbox_relax', '3810,1654', 'U2', 'Sandbox AND Relaxing'),
    ('management_relax', '12472,1654', 'U2', 'Management AND Relaxing'),
    ('godgame_sim', '5300,599', 'U2', 'God Game AND Simulation'),
    ('idler_relax', '615955,1654', 'U2', 'Idler AND Relaxing'),
    ('incremental_relax', '560542,1654', 'U2', 'Incremental AND Relaxing'),
    ('romance_sim', '4947,599', 'U2', 'Romance AND Simulation'),
    ('otome_sim', '31579,599', 'U2', 'Otome AND Simulation'),
    ('async', '17770', 'U2', 'Asynchronous Multiplayer'),
    # added 2026-10-21 21:25 after the 10-08 check: Slime Rancher (Cute+Simulation, no life tag) and
    # FANTASY LIFE i (City Builder+Cute, no Relaxing) were outside every query above
    ('cute_sim', '4726,599', 'U2', 'Cute AND Simulation'),
    ('citybuilder_cute', '4328,4726', 'U2', 'City Builder AND Cute'),
    # ---- L language / education (wholesale, threshold 100)
    ('education', '1036', 'L', 'Education'),
    ('langlearning', '21635', 'L', 'Language Learning'),
    ('wordgame', '24003', 'L', 'Word Game'),
    ('spelling', '71389', 'L', 'Spelling'),
    ('typing', '1674', 'L2', 'Typing'),
    ('trivia', '10437', 'L2', 'Trivia'),
    # ---- X classification-only intersections (subsets of U1)
    ('x_mgmt_lifesim', '12472,10235', 'X', 'Management AND Life Sim'),
    ('x_mgmt_cozy', '12472,97376', 'X', 'Management AND Cozy'),
    ('x_sandbox_lifesim', '3810,10235', 'X', 'Sandbox AND Life Sim'),
    ('x_sandbox_cozy', '3810,97376', 'X', 'Sandbox AND Cozy'),
    ('x_story_lifesim', '1742,10235', 'X', 'Story Rich AND Life Sim'),
    ('x_story_cozy', '1742,97376', 'X', 'Story Rich AND Cozy'),
    ('x_choices_lifesim', '6426,10235', 'X', 'Choices Matter AND Life Sim'),
    ('x_emotional_cozy', '5608,97376', 'X', 'Emotional AND Cozy'),
    ('x_immersive_lifesim', '9204,10235', 'X', 'Immersive Sim AND Life Sim'),
    ('x_building_cozy', '1643,97376', 'X', 'Building AND Cozy'),
    ('x_building_lifesim', '1643,10235', 'X', 'Building AND Life Sim'),
    ('x_crafting_cozy', '1702,97376', 'X', 'Crafting AND Cozy'),
    ('x_citybuilder_cozy', '4328,97376', 'X', 'City Builder AND Cozy'),
    ('x_relaxing_lifesim', '1654,10235', 'X', 'Relaxing AND Life Sim'),
    ('x_cute_lifesim', '4726,10235', 'X', 'Cute AND Life Sim'),
    ('x_cute_cozy', '4726,97376', 'X', 'Cute AND Cozy'),
    ('x_mmo_lifesim', '128,10235', 'X', 'Massively Multiplayer AND Life Sim'),
    ('x_romance_lifesim', '4947,10235', 'X', 'Romance AND Life Sim'),
    ('x_cats_cozy', '17894,97376', 'X', 'Cats AND Cozy'),
    ('x_idler_cozy', '615955,97376', 'X', 'Idler AND Cozy'),
    ('x_async_cozy', '17770,97376', 'X', 'Asynchronous Multiplayer AND Cozy'),
    ('x_education_lifesim', '1036,10235', 'X', 'Education AND Life Sim'),
    ('x_education_cozy', '1036,97376', 'X', 'Education AND Cozy'),
]

PASSES = {
    # pass id: (sort, extra params, which layers)
    'A': ('Reviews_DESC', '&ignore_preferences=1&cc=us', ('U1', 'U2', 'L', 'L2', 'X')),
    'B': ('Reviews_DESC', '', ('U1', 'U2', 'L', 'L2')),
    'C': ('Released_DESC', '&ignore_preferences=1&cc=us', ('U1', 'L', 'L2')),
}
