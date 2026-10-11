// experiences/synk-world-app/life-content.mjs
var choices = (texts) => texts.map((text, index) => ({ id: ["a", "b", "c"][index], text }));
var scene = (speaker, text) => ({ speaker, text });
var expression = (id, korean, meaning) => ({ id, korean, meaning });
var transfer = (prompt, context, texts, answerId, explanation) => ({
  prompt,
  context,
  choices: choices(texts),
  answerId,
  explanation
});
var question = (id, skillId, expressionId, prompt, context, texts, answerId, explanation, review) => ({
  id,
  skillId,
  expressionId,
  prompt,
  context,
  choices: choices(texts),
  answerId,
  explanation,
  review: { ...review, id: `${id}-transfer`, skillId, expressionId }
});
var skill = (id, title) => ({ id, title, domain: "reading" });
var lesson = (id, type, title, goal, expressions, scenes, questions) => ({
  id,
  type,
  title,
  goal,
  expressions,
  scenes,
  questions
});
var greetingExpressions = [
  expression("greet-hello", "\uC548\uB155\uD558\uC138\uC694.", "\uCC98\uC74C \uB9CC\uB098\uAC70\uB098 \uB9CC\uB09C \uC0AC\uB78C\uC5D0\uAC8C \uC815\uC911\uD558\uAC8C \uC778\uC0AC\uD574\uC694."),
  expression("greet-thanks", "\uAC10\uC0AC\uD569\uB2C8\uB2E4.", "\uB3C4\uC6C0\uC744 \uBC1B\uC558\uC744 \uB54C \uC815\uC911\uD558\uAC8C \uACE0\uB9C8\uC6C0\uC744 \uC804\uD574\uC694."),
  expression("greet-name", "\uC800\uB294 \uBABD\uAE00\uC774\uC5D0\uC694.", "\uC790\uAE30 \uC774\uB984\uC744 \uC18C\uAC1C\uD574\uC694. \uC774\uB984 \uB05D\uC5D0 \uBC1B\uCE68\uC774 \uC788\uC73C\uBA74 \u2018\uC774\uC5D0\uC694\u2019\uB97C \uC368\uC694.")
];
var cafeExpressions = [
  expression("cafe-order", "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uC74C\uB8CC\uC758 \uC885\uB958\xB7\uC628\uB3C4\xB7\uC218\uB97C \uD568\uAED8 \uB9D0\uD558\uBA70 \uC8FC\uBB38\uD574\uC694."),
  expression("cafe-here", "\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2DC\uACA0\uB2E4\uACE0 \uB9D0\uD574\uC694."),
  expression("cafe-takeout", "\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uC74C\uB8CC\uB97C \uBC16\uC73C\uB85C \uAC00\uC838\uAC00\uACA0\uB2E4\uACE0 \uB9D0\uD574\uC694.")
];
var cafeTasteExpressions = [
  expression("cafe-preference", "\uB530\uB73B\uD55C \uCC28\uB97C \uB9C8\uC2DC\uACE0 \uC2F6\uC5B4\uC694.", "\uCE5C\uAD6C\uAC00 \uC6D0\uD558\uB294 \uC74C\uB8CC\uC758 \uC885\uB958\uC640 \uC628\uB3C4\uB97C \uC54C\uC544\uBD10\uC694."),
  ...cafeExpressions.filter((item) => ["cafe-order", "cafe-here"].includes(item.id))
];
var cafeSoldoutExpressions = [
  expression("cafe-soldout", "\uC8FC\uC2A4\uB294 \uD488\uC808\uC774\uC5D0\uC694.", "\uD488\uC808\uC740 \uC624\uB298 \uB354 \uC8FC\uBB38\uD560 \uC218 \uC5C6\uB2E4\uB294 \uB73B\uC774\uC5D0\uC694. \uAC00\uB2A5\uD55C \uB2E4\uB978 \uC74C\uB8CC\uB97C \uACE8\uB77C\uC694."),
  ...cafeExpressions.filter((item) => ["cafe-order", "cafe-takeout"].includes(item.id))
];
var cafeChangeExpressions = [
  expression("cafe-change", "\uC8FC\uC2A4 \uB300\uC2E0 \uB530\uB73B\uD55C \uCC28\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694.", "\uC774\uBBF8 \uC8FC\uBB38\uD55C \uC74C\uB8CC\uB97C \uB2E4\uB978 \uC74C\uB8CC\uB85C \uBC14\uAFB8\uC5B4 \uB2EC\uB77C\uACE0 \uBD80\uD0C1\uD574\uC694."),
  expression("cafe-add", "\uD55C \uC794 \uB354 \uC8FC\uC138\uC694.", "\uC8FC\uBB38\uD55C \uC218\uB7C9\uC5D0 \uD55C \uC794\uC744 \uCD94\uAC00\uD574\uC694."),
  ...cafeExpressions.filter((item) => item.id === "cafe-takeout")
];
var cafeComposeExpressions = [
  expression("cafe-compose", "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uC8FC\uC138\uC694.", "\uC74C\uB8CC\xB7\uC628\uB3C4\xB7\uC794 \uC218\uB97C \uC9C1\uC811 \uACE8\uB77C \uD55C \uBB38\uC7A5\uC73C\uB85C \uC8FC\uBB38\uD574\uC694."),
  ...cafeExpressions.filter((item) => ["cafe-order", "cafe-here"].includes(item.id))
];
var storeExpressions = [
  expression("store-price", "\uC774\uAC70 \uC5BC\uB9C8\uC608\uC694?", "\uBB3C\uAC74\uC758 \uAC00\uACA9\uC744 \uBB3C\uC5B4\uC694."),
  expression("store-bag", "\uBD09\uD22C \uD558\uB098 \uC8FC\uC138\uC694.", "\uC0B0 \uBB3C\uAC74\uC744 \uB2F4\uC744 \uBD09\uD22C\uB97C \uBD80\uD0C1\uD574\uC694."),
  expression("store-card", "\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694.", "\uCE74\uB4DC\uB85C \uAC12\uC744 \uB0B4\uACA0\uB2E4\uACE0 \uB9D0\uD574\uC694.")
];
var directionExpressions = [
  expression("directions-where", "\uACF5\uC6D0\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uAC00\uB824\uB294 \uC7A5\uC18C\uC758 \uC704\uCE58\uB97C \uBB3C\uC5B4\uC694."),
  expression("directions-right", "\uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC138\uC694.", "\uC624\uB978\uCABD \uBC29\uD5A5\uC73C\uB85C \uC774\uB3D9\uD558\uB77C\uB294 \uC548\uB0B4\uC608\uC694."),
  expression("directions-beside", "\uC740\uD589 \uC606\uC5D0 \uC788\uC5B4\uC694.", "\uC740\uD589 \uBC14\uB85C \uC606\uC5D0 \uC788\uB294 \uC7A5\uC18C\uB97C \uC124\uBA85\uD574\uC694.")
];
var transitExpressions = [
  expression("transit-destination", "\uC774 \uBC84\uC2A4\uB294 \uACF5\uC6D0\uC5D0 \uAC00\uC694?", "\uD0C0\uB824\uB294 \uBC84\uC2A4\uAC00 \uBAA9\uC801\uC9C0\uB85C \uAC00\uB294\uC9C0 \uD655\uC778\uD574\uC694."),
  expression("transit-alight", "\uB2E4\uC74C \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694.", "\uC9C0\uAE08 \uC815\uB958\uC7A5\uC774 \uC544\uB2C8\uB77C \uADF8\uB2E4\uC74C \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694."),
  expression("transit-card", "\uAD50\uD1B5\uCE74\uB4DC\uB97C \uCC0D\uC73C\uC138\uC694.", "\uBC84\uC2A4\uC758 \uCE74\uB4DC \uB2E8\uB9D0\uAE30\uC5D0 \uAD50\uD1B5\uCE74\uB4DC\uB97C \uB300\uB77C\uB294 \uC548\uB0B4\uC608\uC694.")
];
var planExpressions = [
  expression("plans-time", "\uB0B4\uC77C \uC624\uD6C4 \uC138 \uC2DC\uC5D0 \uB9CC\uB098\uC694.", "\uB9CC\uB0A0 \uB0A0\uC9DC\uC640 \uC2DC\uAC04\uC744 \uC815\uD574\uC694."),
  expression("plans-place", "\uC5B4\uB514\uC5D0\uC11C \uB9CC\uB0A0\uAE4C\uC694?", "\uB9CC\uB0A0 \uC7A5\uC18C\uB97C \uD568\uAED8 \uC815\uD558\uB824\uACE0 \uBB3C\uC5B4\uC694."),
  expression("plans-delay", "\uC870\uAE08 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694.", "\uC57D\uC18D \uC2DC\uAC04\uBCF4\uB2E4 \uB2A6\uAC8C \uB3C4\uCC29\uD560 \uAC83 \uAC19\uB2E4\uACE0 \uC54C\uB824\uC694.")
];
var PACKS = [
  {
    id: "greetings",
    title: "\uCC98\uC74C \uB9CC\uB09C \uB0A0",
    subtitle: "\uC778\uC0AC\uD558\uACE0 \uC774\uB984\uC744 \uB098\uB220\uC694",
    icon: "greeting",
    level: "\uAE30\uCD08 \uC0DD\uD65C \uD55C\uAD6D\uC5B4",
    skills: [skill("greet-response", "\uC0C1\uD669\uC5D0 \uB9DE\uAC8C \uC778\uC0AC\uD558\uAE30"), skill("greet-gratitude", "\uACE0\uB9C8\uC6C0 \uC804\uD558\uAE30"), skill("greet-introduction", "\uC774\uB984 \uC18C\uAC1C \uC774\uD574\uD558\uAE30")],
    lessons: [
      lesson("greetings-expressions", "expressions", "\uCCAB \uC778\uC0AC \uC138 \uB9C8\uB514", "\uB9CC\uB0A8\xB7\uAC10\uC0AC\xB7\uC18C\uAC1C\uC5D0 \uB9DE\uB294 \uD45C\uD604\uC744 \uACE8\uB77C\uC694.", greetingExpressions, [
        scene("mongle", "\uC6B0\uC640! \uCC98\uC74C \uB9CC\uB09C \uCE5C\uAD6C\uC57C! \uAC19\uC774 \uC778\uC0AC\uD574 \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uC774\uB984\uB9CC \uB9D0\uD574\uB3C4 \uB2E4 \uC54C\uC544\uBCF4\uC9C0. \u2026\uCC98\uC74C\uC774\uBA74 \uC778\uC0AC\uBD80\uD130 \uD558\uB294 \uAC70\uC57C."),
        scene("marine", "\uCCAB \uB9CC\uB0A8 \uD655\uC778. \uC778\uC0AC, \uC774\uB984, \uACE0\uB9C8\uC6C0. \uC900\uBE44 \uC644\uB8CC.")
      ], [
        question("greetings-expressions-hello", "greet-response", "greet-hello", "\uCC98\uC74C \uB9CC\uB09C \uC120\uC0DD\uB2D8\uC5D0\uAC8C \uC5B4\uB5A4 \uC778\uC0AC\uB97C \uD560\uAE4C\uC694?", "\uAD50\uC2E4\uC5D0 \uB4E4\uC5B4\uAC00 \uC120\uC0DD\uB2D8\uC744 \uCC98\uC74C \uB9CC\uB0AC\uC5B4\uC694.", ["\uC548\uB155\uD558\uC138\uC694.", "\uAC10\uC0AC\uD569\uB2C8\uB2E4.", "\uB2E4\uB140\uC654\uC5B4\uC694."], "a", "\uC0C8\uB85C \uB9CC\uB09C \uC0AC\uB78C\uC5D0\uAC8C\uB294 \u2018\uC548\uB155\uD558\uC138\uC694\u2019\uB77C\uACE0 \uC778\uC0AC\uD574\uC694.", transfer("\uD559\uAD50\uC5D0\uC11C \uCC98\uC74C \uB9CC\uB09C \uC9C1\uC6D0\uC5D0\uAC8C \uC778\uC0AC\uD574\uC694.", "\uC544\uC9C1 \uB3C4\uC6C0\uC744 \uBC1B\uAC70\uB098 \uD5E4\uC5B4\uC9C0\uB294 \uC0C1\uD669\uC740 \uC544\uB2C8\uC5D0\uC694.", ["\uB2E4\uB140\uC654\uC5B4\uC694.", "\uC548\uB155\uD558\uC138\uC694.", "\uAC10\uC0AC\uD569\uB2C8\uB2E4."], "b", "\uCC98\uC74C \uB9CC\uB09C \uC9C1\uC6D0\uC5D0\uAC8C \uC815\uC911\uD558\uAC8C \u2018\uC548\uB155\uD558\uC138\uC694\u2019\uB77C\uACE0 \uD574\uC694.")),
        question("greetings-expressions-thanks", "greet-gratitude", "greet-thanks", "\uB3C4\uC6C0\uC744 \uBC1B\uC558\uC5B4\uC694. \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "\uCE5C\uAD6C\uAC00 \uB5A8\uC5B4\uC9C4 \uCC45\uC744 \uC8FC\uC6CC \uC92C\uC5B4\uC694.", ["\uC800\uB294 \uBABD\uAE00\uC774\uC5D0\uC694.", "\uC548\uB155\uD558\uC138\uC694.", "\uAC10\uC0AC\uD569\uB2C8\uB2E4."], "c", "\uB3C4\uC6C0\uC744 \uBC1B\uC740 \uB4A4\uC5D0\uB294 \u2018\uAC10\uC0AC\uD569\uB2C8\uB2E4\u2019\uB85C \uACE0\uB9C8\uC6C0\uC744 \uC804\uD574\uC694.", transfer("\uC9C1\uC6D0\uC774 \uC783\uC5B4\uBC84\uB9B0 \uC6B0\uC0B0\uC744 \uCC3E\uC544 \uC92C\uC5B4\uC694.", "\uB3C4\uC6C0\uC744 \uC900 \uC9C1\uC6D0\uC5D0\uAC8C \uACE0\uB9C8\uC6C0\uC744 \uC804\uD558\uB824\uACE0 \uD574\uC694.", ["\uAC10\uC0AC\uD569\uB2C8\uB2E4.", "\uCC98\uC74C \uBD59\uACA0\uC2B5\uB2C8\uB2E4.", "\uC800\uB294 \uB9C8\uB9B0\uC774\uC5D0\uC694."], "a", "\uC6B0\uC0B0\uC744 \uCC3E\uC544 \uC900 \uB3C4\uC6C0\uC5D0 \u2018\uAC10\uC0AC\uD569\uB2C8\uB2E4\u2019\uB77C\uACE0 \uB9D0\uD574\uC694.")),
        question("greetings-expressions-name", "greet-introduction", "greet-name", "\uC790\uAE30 \uC774\uB984\uC744 \uC18C\uAC1C\uD558\uB294 \uB9D0\uC744 \uACE8\uB77C\uC694.", "\uB0B4 \uC774\uB984\uC740 \uBABD\uAE00\uC774\uC5D0\uC694.", ["\uC800\uB294 \uD559\uAD50\uC5D0 \uAC00\uC694.", "\uC800\uB294 \uBABD\uAE00\uC774\uC5D0\uC694.", "\uBABD\uAE00\uC740 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?"], "b", "\u2018\uC800\uB294 \uBABD\uAE00\uC774\uC5D0\uC694\u2019\uB294 \uB0B4\uAC00 \uBABD\uAE00\uC774\uB77C\uB294 \uC18C\uAC1C\uC608\uC694.", transfer("\uC790\uAE30 \uC774\uB984\uC744 \uC18C\uAC1C\uD558\uB294 \uB9D0\uC744 \uACE8\uB77C\uC694.", "\uB0B4 \uC774\uB984\uC740 \uB9C8\uB9B0\uC774\uC5D0\uC694.", ["\uB9C8\uB9B0\uC740 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uC800\uB294 \uB9C8\uB9B0\uC774\uC5D0\uC694.", "\uB9C8\uB9B0\uC740 \uD559\uAD50\uC5D0 \uAC00\uC694."], "b", "\u2018\uC800\uB294 \uB9C8\uB9B0\uC774\uC5D0\uC694\u2019\uB294 \uC790\uAE30 \uC774\uB984\uC744 \uB9D0\uD558\uB294 \uC18C\uAC1C\uC608\uC694."))
      ]),
      lesson("greetings-story", "story", "\uC774\uB984\uD45C\uB97C \uCC3E\uC544\uC11C", "\uC774\uC57C\uAE30\uB97C \uC77D\uACE0 \uC778\uC0AC\uC640 \uC18C\uAC1C\uC758 \uB73B\uC744 \uD655\uC778\uD574\uC694.", greetingExpressions, [
        scene("narrator", "\uD55C\uAC15 \uB9C8\uB8E8\uC758 \uCCAB \uBAA8\uC784 \uB0A0\uC774\uC5D0\uC694. \uC785\uAD6C\uC5D0\uB294 \uC774\uB984\uD45C \uC138 \uC7A5\uC774 \uB193\uC5EC \uC788\uC5B4\uC694."),
        scene("mongle", "\uC6B0\uC640! \uC6B0\uB9AC \uC774\uB984\uC774 \uC788\uB124! \uAC19\uC774 \uC778\uC0AC\uBD80\uD130 \uD560\uAE4C?"),
        scene("mongle", "\uC548\uB155\uD558\uC138\uC694! \uC800\uB294 \uBABD\uAE00\uC774\uC5D0\uC694!"),
        scene("kkamong", "\uC774 \uBAB8\uC758 \uC774\uB984\uD45C\uB294 \uB2F9\uC5F0\uD788 \uC81C\uC77C \uD070\u2026 \uC5B4, \uB0B4 \uC774\uB984\uD45C \uC5B4\uB514 \uAC14\uC9C0."),
        scene("narrator", "\uAE4C\uBABD\uC758 \uC774\uB984\uD45C\uAC00 \uAE4C\uBABD\uC758 \uB4A4\uC5D0 \uBD99\uC5B4 \uC788\uC5B4\uC694. \uB9C8\uB9B0\uC774 \uC870\uC2EC\uD788 \uB5BC\uC5B4 \uC918\uC694."),
        scene("marine", "\uC774\uB984\uD45C \uBC1C\uACAC. \uAE4C\uBABD. \uD655\uC778 \uC644\uB8CC."),
        scene("kkamong", "\uB0B4\uAC00 \uB4A4\uAE4C\uC9C0 \uBCFC \uC218 \uC788\uAC8C \uBD99\uC778 \uAC70\uC9C0. \u2026\uADF8\uB798\uB3C4 \uAC10\uC0AC\uD569\uB2C8\uB2E4."),
        scene("mongle", "\uC6B0\uC640! \uC774\uC81C \uC138 \uC774\uB984\uC774 \uB2E4 \uBCF4\uC5EC! \uAC19\uC774 \uC549\uC790!"),
        scene("marine", "\uC804\uC6D0 \uD655\uC778. \uC790\uB9AC, \uC14B. \u2026\uB124 \uC790\uB9AC\uB3C4 \uC5EC\uAE30\uB2E4.")
      ], [
        question("greetings-story-name", "greet-introduction", "greet-name", "\uCC98\uC74C\uC5D0 \u2018\uC800\uB294 \uBABD\uAE00\uC774\uC5D0\uC694\u2019\uB77C\uACE0 \uC18C\uAC1C\uD55C \uCE5C\uAD6C\uB294 \uB204\uAD6C\uC608\uC694?", "", ["\uAE4C\uBABD", "\uBABD\uAE00", "\uB9C8\uB9B0"], "b", "\uBABD\uAE00\uC774 \uC790\uAE30 \uC774\uB984\uC744 \uB9D0\uD558\uBA70 \uC778\uC0AC\uD588\uC5B4\uC694.", transfer("\u2018\uC800\uB294 \uAE4C\uBABD\uC774\uC5D0\uC694.\u2019\uB77C\uACE0 \uC4F4 \uC774\uB984\uD45C\uC758 \uC8FC\uC778\uC740 \uB204\uAD6C\uC608\uC694?", "\uC0C8 \uBAA8\uC784\uC758 \uC774\uB984\uD45C\uB97C \uC77D\uACE0 \uC788\uC5B4\uC694.", ["\uB9C8\uB9B0", "\uBABD\uAE00", "\uAE4C\uBABD"], "c", "\u2018\uC800\uB294 \uAE4C\uBABD\uC774\uC5D0\uC694\u2019\uC5D0\uC11C \uC18C\uAC1C\uD55C \uC774\uB984\uC740 \uAE4C\uBABD\uC774\uC5D0\uC694.")),
        question("greetings-story-thanks", "greet-gratitude", "greet-thanks", "\uAE4C\uBABD\uC774 \u2018\uAC10\uC0AC\uD569\uB2C8\uB2E4\u2019\uB77C\uACE0 \uD55C \uC774\uC720\uB294 \uBB34\uC5C7\uC774\uC5D0\uC694?", "", ["\uB9C8\uB9B0\uC774 \uC774\uB984\uD45C\uB97C \uCC3E\uC544 \uC92C\uC5B4\uC694.", "\uBABD\uAE00\uC774 \uBA3C\uC800 \uC9D1\uC5D0 \uAC14\uC5B4\uC694.", "\uAE4C\uBABD\uC774 \uC790\uAE30 \uC774\uB984\uC744 \uC78A\uC5C8\uC5B4\uC694."], "a", "\uB9C8\uB9B0\uC774 \uB4A4\uC5D0 \uBD99\uC740 \uC774\uB984\uD45C\uB97C \uB5BC\uC5B4 \uC900 \uB3C4\uC6C0\uC5D0 \uACE0\uB9C8\uC6C0\uC744 \uC804\uD588\uC5B4\uC694.", transfer("\uBABD\uAE00\uC774 \u2018\uAC10\uC0AC\uD569\uB2C8\uB2E4\u2019\uB77C\uACE0 \uD588\uC5B4\uC694. \uC5B4\uB5A4 \uC77C\uC774 \uC788\uC5C8\uC744\uAE4C\uC694?", "\uB9C8\uB9B0\uC774 \uBABD\uAE00\uC5D0\uAC8C \uB5A8\uC5B4\uC9C4 \uC774\uB984\uD45C\uB97C \uAC74\uB124\uC92C\uC5B4\uC694.", ["\uB9C8\uB9B0\uC774 \uC774\uB984\uD45C\uB97C \uCC3E\uC544 \uC92C\uC5B4\uC694.", "\uB9C8\uB9B0\uC774 \uC790\uAE30 \uC774\uB984\uC744 \uC18C\uAC1C\uD588\uC5B4\uC694.", "\uB9C8\uB9B0\uC774 \uBAA8\uC784 \uC2DC\uAC04\uC744 \uBB3C\uC5C8\uC5B4\uC694."], "a", "\uC774\uB984\uD45C\uB97C \uAC74\uB124\uC900 \uB3C4\uC6C0\uC744 \uBC1B\uC544\uC11C \uACE0\uB9C8\uC6C0\uC744 \uC804\uD588\uC5B4\uC694.")),
        question("greetings-story-hello", "greet-response", "greet-hello", "\uBAA8\uC784\uC5D0\uC11C \uCC98\uC74C \uB9CC\uB09C \uC0AC\uB78C\uC5D0\uAC8C \uBA3C\uC800 \uD560 \uB9D0\uC744 \uACE8\uB77C\uC694.", "", ["\uC798 \uBA39\uACA0\uC2B5\uB2C8\uB2E4.", "\uB2E4\uB140\uC654\uC2B5\uB2C8\uB2E4.", "\uC548\uB155\uD558\uC138\uC694."], "c", "\uBAA8\uC784\uC5D0\uC11C \uCC98\uC74C \uB9CC\uB09C \uC0AC\uB78C\uC5D0\uAC8C\uB294 \u2018\uC548\uB155\uD558\uC138\uC694\u2019\uB77C\uACE0 \uC778\uC0AC\uD574\uC694.", transfer("\uC0C8 \uB3D9\uC544\uB9AC\uC5D0\uC11C \uCC98\uC74C \uB9CC\uB09C \uCE5C\uAD6C\uC5D0\uAC8C \uC815\uC911\uD558\uAC8C \uC778\uC0AC\uD574\uC694.", "\uC9C0\uAE08\uC740 \uC2DD\uC0AC\uD558\uAC70\uB098 \uC678\uCD9C\uD588\uB2E4 \uB3CC\uC544\uC628 \uC0C1\uD669\uC774 \uC544\uB2C8\uC5D0\uC694.", ["\uC548\uB155\uD558\uC138\uC694.", "\uC798 \uBA39\uACA0\uC2B5\uB2C8\uB2E4.", "\uB2E4\uB140\uC654\uC2B5\uB2C8\uB2E4."], "a", "\uCC98\uC74C \uB9CC\uB09C \uC790\uB9AC\uC758 \uC778\uC0AC\uB294 \u2018\uC548\uB155\uD558\uC138\uC694\u2019\uC608\uC694."))
      ]),
      lesson("greetings-apply", "apply", "\uB0B4 \uCCAB \uBAA8\uC784", "\uC0C8\uB85C\uC6B4 \uB9CC\uB0A8\uC5D0\uC11C \uD544\uC694\uD55C \uB9D0\uC744 \uC9C1\uC811 \uACE8\uB77C\uC694.", greetingExpressions, [
        scene("mongle", "\uC624! \uC774\uBC88\uC5D0\uB294 \uB124 \uCC28\uB840\uC57C! \uAC19\uC774 \uCCAB \uC778\uC0AC \uD574 \uBCFC\uAE4C?"),
        scene("kkamong", "\uB0B4 \uCCAB \uBAA8\uC784\uC740 \uC644\uBCBD\uD588\uC9C0. \uC774\uB984\uD45C\uAC00 \uB4A4\uC5D0 \uBD99\uC740 \uAC83\uB9CC \uBE7C\uBA74."),
        scene("marine", "\uC0C1\uD669 \uD655\uC778. \uC0C1\uB300\uC5D0\uAC8C \uC804\uD560 \uB9D0\uC744 \uC120\uD0DD\uD558\uB77C.")
      ], [
        question("greetings-apply-introduction", "greet-introduction", "greet-name", "\uC774\uB984\uC744 \uBB3B\uB294 \uB9D0\uC5D0 \uB2F5\uD574\uC694.", "\u201C\uC774\uB984\uC774 \uBB50\uC608\uC694?\u201D \uB0B4 \uC774\uB984\uC740 \uC218\uC9C4\uC774\uC5D0\uC694.", ["\uD559\uAD50\uC5D0 \uC788\uC5B4\uC694.", "\uC800\uB294 \uC218\uC9C4\uC774\uC5D0\uC694.", "\uAC10\uC0AC\uD569\uB2C8\uB2E4."], "b", "\uC774\uB984\uC744 \uBB3C\uC5C8\uC73C\uBBC0\uB85C \u2018\uC800\uB294 \uC218\uC9C4\uC774\uC5D0\uC694\u2019\uB77C\uACE0 \uC18C\uAC1C\uD574\uC694.", transfer("\uC774\uB984\uC744 \uBB3B\uB294 \uB9D0\uC5D0 \uB2F5\uD574\uC694.", "\u201C\uC131\uD568\uC774 \uC5B4\uB5BB\uAC8C \uB418\uC138\uC694?\u201D \uB0B4 \uC774\uB984\uC740 \uC9C0\uD6C8\uC774\uC5D0\uC694.", ["\uC800\uB294 \uC9C0\uD6C8\uC774\uC5D0\uC694.", "\uC9C0\uD6C8\uC740 \uC9D1\uC5D0 \uC788\uC5B4\uC694.", "\uC548\uB155\uD558\uC138\uC694."], "a", "\u2018\uC131\uD568\u2019\uC740 \uC774\uB984\uC744 \uB192\uC5EC \uB9D0\uD55C \uD45C\uD604\uC774\uC5D0\uC694. \uC790\uAE30 \uC774\uB984\uC744 \uB2F5\uD574\uC694.")),
        question("greetings-apply-thanks", "greet-gratitude", "greet-thanks", "\uD544\uC694\uD55C \uB9D0\uC744 \uACE8\uB77C\uC694.", "\uCC98\uC74C \uC628 \uD559\uAD50\uC5D0\uC11C \uC9C1\uC6D0\uC774 \uAD50\uC2E4 \uC704\uCE58\uB97C \uC54C\uB824 \uC92C\uC5B4\uC694. \uACE0\uB9C8\uC6C0\uC744 \uC804\uD558\uB824\uACE0 \uD574\uC694.", ["\uC800\uB294 \uD559\uC0DD\uC774\uC5D0\uC694.", "\uC548\uB155\uD558\uC138\uC694.", "\uAC10\uC0AC\uD569\uB2C8\uB2E4."], "c", "\uC704\uCE58\uB97C \uC54C\uB824 \uC900 \uB3C4\uC6C0\uC5D0 \u2018\uAC10\uC0AC\uD569\uB2C8\uB2E4\u2019\uB77C\uACE0 \uD574\uC694.", transfer("\uC9C0\uAE08 \uD544\uC694\uD55C \uB9D0\uC744 \uACE8\uB77C\uC694.", "\uCE74\uD398 \uC9C1\uC6D0\uC774 \uB450\uACE0 \uC628 \uAC00\uBC29\uC744 \uCC3E\uC544 \uC92C\uC5B4\uC694. \uB3C4\uC6C0\uC5D0 \uACE0\uB9C8\uC6C0\uC744 \uC804\uD558\uB824\uACE0 \uD574\uC694.", ["\uC548\uB155\uD558\uC138\uC694.", "\uAC10\uC0AC\uD569\uB2C8\uB2E4.", "\uC800\uB294 \uB9C8\uB9B0\uC774\uC5D0\uC694."], "b", "\uAC00\uBC29\uC744 \uCC3E\uC544 \uC900 \uB3C4\uC6C0\uC5D0 \uACE0\uB9C8\uC6C0\uC744 \uC804\uD558\uB294 \uB9D0\uC740 \u2018\uAC10\uC0AC\uD569\uB2C8\uB2E4\u2019\uC608\uC694.")),
        question("greetings-apply-hello", "greet-response", "greet-hello", "\uAD50\uC2E4 \uBB38\uC744 \uC5F4\uACE0 \uCC98\uC74C \uB9CC\uB09C \uC120\uC0DD\uB2D8\uC5D0\uAC8C \uB9D0\uD574\uC694.", "\uC544\uC9C1 \uB300\uD654\uB97C \uC2DC\uC791\uD558\uAE30 \uC804\uC774\uC5D0\uC694.", ["\uC548\uB155\uD558\uC138\uC694.", "\uC800\uB294 \uC2DD\uC0AC\uD588\uC5B4\uC694.", "\uAC10\uC0AC\uD569\uB2C8\uB2E4."], "a", "\uB300\uD654\uB97C \uC2DC\uC791\uD558\uAE30 \uC804\uC5D0 \u2018\uC548\uB155\uD558\uC138\uC694\u2019\uB85C \uC815\uC911\uD558\uAC8C \uC778\uC0AC\uD574\uC694.", transfer("\uCC98\uC74C \uBC29\uBB38\uD55C \uAC00\uAC8C\uC758 \uC9C1\uC6D0\uC5D0\uAC8C \uB9D0\uC744 \uC2DC\uC791\uD574\uC694.", "\uC544\uC9C1 \uC0C1\uD488\uC744 \uACE0\uB974\uAC70\uB098 \uB3C4\uC6C0\uC744 \uBC1B\uAE30 \uC804\uC774\uC5D0\uC694.", ["\uAC10\uC0AC\uD569\uB2C8\uB2E4.", "\uC798 \uBA39\uACA0\uC2B5\uB2C8\uB2E4.", "\uC548\uB155\uD558\uC138\uC694."], "c", "\uCC98\uC74C \uB300\uD654\uB97C \uC2DC\uC791\uD560 \uB54C \uC815\uC911\uD55C \uC778\uC0AC\uB294 \u2018\uC548\uB155\uD558\uC138\uC694\u2019\uC608\uC694."))
      ])
    ]
  },
  {
    id: "cafe",
    title: "\uAD6C\uB984 \uD55C \uC794, \uCE74\uD398",
    subtitle: "\uC8FC\uBB38\uD558\uACE0 \uB9C8\uC2E4 \uACF3\uC744 \uC815\uD574\uC694",
    icon: "cafe",
    level: "\uAE30\uCD08 \uC0DD\uD65C \uD55C\uAD6D\uC5B4",
    skills: [skill("cafe-order-detail", "\uC74C\uB8CC\uC640 \uC218\uB7C9 \uC774\uD574\uD558\uAE30"), skill("cafe-place", "\uB9C8\uC2E4 \uC7A5\uC18C \uAD6C\uBD84\uD558\uAE30"), skill("cafe-takeout-request", "\uD3EC\uC7A5 \uC694\uCCAD\uD558\uAE30"), skill("cafe-preference-reading", "\uCE5C\uAD6C\uC758 \uCDE8\uD5A5 \uC774\uD574\uD558\uAE30"), skill("cafe-availability", "\uD488\uC808\uACFC \uC8FC\uBB38 \uAC00\uB2A5 \uC548\uB0B4 \uC77D\uAE30"), skill("cafe-order-change", "\uC8FC\uBB38 \uBCC0\uACBD \uC774\uD574\uD558\uAE30"), skill("cafe-compose-order", "\uC8FC\uBB38 \uBB38\uC7A5 \uAD6C\uC131\uD558\uAE30")],
    lessons: [
      lesson("cafe-expressions", "expressions", "\uCE74\uD398\uC5D0\uC11C \uD558\uB294 \uB9D0", "\uC8FC\uBB38\xB7\uB9E4\uC7A5 \uC774\uC6A9\xB7\uD3EC\uC7A5 \uD45C\uD604\uC744 \uAD6C\uBD84\uD574\uC694.", cafeExpressions, [
        scene("mongle", "\uC6B0\uC640! \uCC28 \uC704\uC5D0 \uC791\uC740 \uAD6C\uB984\uC774 \uC788\uC5B4! \uAC19\uC774 \uC8FC\uBB38\uD574 \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uCC28\uC758 \uC628\uB3C4\uB3C4 \uC815\uD558\uC9C0. \uB728\uAC81\u2026 \uC544\uB2C8, \uB530\uB73B\uD55C \uAC78\uB85C."),
        scene("marine", "\uC8FC\uBB38 \uC900\uBE44. \uC74C\uB8CC, \uC218\uB7C9, \uB9C8\uC2E4 \uC7A5\uC18C \uD655\uC778.")
      ], [
        question("cafe-expressions-order", "cafe-order-detail", "cafe-order", "\uC8FC\uBB38\uC5D0 \uB9DE\uB294 \uC74C\uB8CC\uB97C \uACE8\uB77C\uC694.", "\u201C\uB530\uB73B\uD55C \uCC28 \uD55C \uC794 \uC8FC\uC138\uC694.\u201D", ["\uCC28\uAC00\uC6B4 \uCC28 \uB450 \uC794", "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794", "\uB530\uB73B\uD55C \uBB3C \uC138 \uC794"], "b", "\u2018\uB530\uB73B\uD55C \uCC28\u2019\uAC00 \uC885\uB958\uC640 \uC628\uB3C4\uC774\uACE0 \u2018\uD55C \uC794\u2019\uC774 \uC218\uB7C9\uC774\uC5D0\uC694.", transfer("\uC8FC\uBB38\uC5D0 \uB9DE\uB294 \uC74C\uB8CC\uB97C \uACE8\uB77C\uC694.", "\u201C\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uB450 \uC794 \uC8FC\uC138\uC694.\u201D", ["\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uB450 \uC794", "\uB530\uB73B\uD55C \uC8FC\uC2A4 \uB450 \uC794", "\uCC28\uAC00\uC6B4 \uCC28 \uD55C \uC794"], "a", "\uC8FC\uC2A4\xB7\uCC28\uAC00\uC6B4 \uC628\uB3C4\xB7\uB450 \uC794\uC744 \uBAA8\uB450 \uD655\uC778\uD574\uC694.")),
        question("cafe-expressions-here", "cafe-place", "cafe-here", "\u2018\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694\u2019\uB294 \uBB34\uC2A8 \uB73B\uC774\uC5D0\uC694?", "\uCE74\uD398 \uC9C1\uC6D0\uC774 \uB9C8\uC2E4 \uC7A5\uC18C\uB97C \uBB3C\uC5C8\uC5B4\uC694.", ["\uBC16\uC73C\uB85C \uAC00\uC838\uAC08\uAC8C\uC694.", "\uC74C\uB8CC\uB97C \uC8FC\uBB38\uD558\uC9C0 \uC54A\uC744\uAC8C\uC694.", "\uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694."], "c", "\uCE74\uD398\uC5D0\uC11C \uB9D0\uD55C \u2018\uC5EC\uAE30\uC11C\u2019\uB294 \uADF8 \uCE74\uD398 \uC548\uC744 \uAC00\uB9AC\uCF1C\uC694.", transfer("\u2018\uB9E4\uC7A5\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694\u2019\uB294 \uBB34\uC2A8 \uB73B\uC774\uC5D0\uC694?", "\uC9C1\uC6D0\uC774 \uD3EC\uC7A5\uD560\uC9C0 \uBB3C\uC5C8\uC5B4\uC694.", ["\uC9D1\uC73C\uB85C \uAC00\uC838\uAC08\uAC8C\uC694.", "\uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uCEF5\uC744 \uB3CC\uB824\uB4DC\uB9B4\uAC8C\uC694."], "b", "\u2018\uB9E4\uC7A5\uC5D0\uC11C\u2019\uB294 \uAC00\uAC8C \uC548\uC5D0\uC11C \uC774\uC6A9\uD558\uACA0\uB2E4\uB294 \uB73B\uC774\uC5D0\uC694.")),
        question("cafe-expressions-takeout", "cafe-takeout-request", "cafe-takeout", "\uC74C\uB8CC\uB97C \uBC16\uC73C\uB85C \uAC00\uC838\uAC00\uACE0 \uC2F6\uC5B4\uC694. \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "", ["\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uB530\uB73B\uD558\uAC8C \uB9C8\uC2E4\uAC8C\uC694."], "a", "\uC74C\uB8CC\uB97C \uAC00\uC838\uAC08 \uB54C\uB294 \u2018\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694\u2019\uB77C\uACE0 \uC694\uCCAD\uD574\uC694.", transfer("\uC8FC\uC2A4\uB97C \uC9D1\uC5D0 \uAC00\uC838\uAC00\uB824\uACE0 \uD574\uC694. \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "", ["\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uC798 \uB9C8\uC168\uC2B5\uB2C8\uB2E4.", "\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694."], "c", "\uC9D1\uC5D0 \uAC00\uC838\uAC00\uB824\uBA74 \uD3EC\uC7A5\uC744 \uC694\uCCAD\uD574\uC694."))
      ]),
      lesson("cafe-story", "story", "\uAD6C\uB984\uC744 \uAC00\uC838\uAC08 \uC218 \uC788\uC744\uAE4C?", "\uC138 \uCE5C\uAD6C\uC758 \uC8FC\uBB38\uACFC \uC7A5\uC18C \uBCC0\uACBD\uC744 \uC774\uD574\uD574\uC694.", cafeExpressions, [
        scene("narrator", "\uC138 \uCE5C\uAD6C\uAC00 \uAC15\uAC00\uC758 \uCE74\uD398\uC5D0 \uB4E4\uC5B4\uC654\uC5B4\uC694. \uCC3D\uAC00\uC5D0\uB294 \uC791\uC740 \uD654\uBD84\uC774 \uC788\uC5B4\uC694."),
        scene("mongle", "\uC6B0\uC640! \uCEF5\uC5D0\uC11C \uAD6C\uB984\uC774 \uB098\uC640! \uAC19\uC774 \uB530\uB73B\uD55C \uCC28 \uB9C8\uC2E4\uAE4C?"),
        scene("kkamong", "\uCC28 \uC8FC\uBB38\uC740 \uC774 \uBAB8\uC5D0\uAC8C \uB9E1\uACA8. \u2018\uB530\uB73B\uD55C \uCC28 \uC138 \uC794 \uC8FC\uC138\uC694.\u2019"),
        scene("marine", "\uC218\uB7C9 \uD655\uC778. \uC14B, \uC138 \uC794. \uCC3D\uAC00 \uC790\uB9AC \uD655\uC778."),
        scene("narrator", "\uCC98\uC74C\uC5D0\uB294 \uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2DC\uB824\uACE0 \uD574\uC694. \uC8FC\uBB38\uD45C\uC5D0\uB294 \u2018\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694\u2019\uB77C\uACE0 \uC801\uC5B4\uC694."),
        scene("mongle", "\uC5B4? \uBC16\uC5D0 \uC791\uC740 \uC0C8\uAC00 \uC788\uB124! \uAC19\uC774 \uAC15\uAC00 \uBCA4\uCE58\uB85C \uAC08\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uB3C4 \uC6D0\uB798 \uBC16\uC5D0\uC11C \uB9C8\uC2DC\uB824\uB358 \uAC70\uC9C0. \uC0C8\uB97C \uBCF4\uB7EC \uAC00\uB294 \uAC74\u2026 \uC870\uAE08\uB9CC."),
        scene("narrator", "\uCE5C\uAD6C\uB4E4\uC740 \uCC28\uB97C \uAC00\uC838\uAC00\uAE30\uB85C \uBC14\uAFD4\uC694. \uC9C1\uC6D0\uC5D0\uAC8C \u2018\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694\u2019\uB77C\uACE0 \uBD80\uD0C1\uD574\uC694."),
        scene("marine", "\uC7A5\uC18C \uBCC0\uACBD \uD655\uC778. \uBCA4\uCE58, \uC138 \uC790\uB9AC. \u2026\uB124 \uCEF5\uC740 \uC5EC\uAE30\uB2E4."),
        scene("mongle", "\uC624! \uCEF5\uC740 \uAC00\uC838\uC654\uB294\uB370 \uAD6C\uB984\uC740 \uC704\uB85C \uAC00\uB124! \uAC19\uC774 \uCC9C\uCC9C\uD788 \uB9C8\uC2DC\uC790!")
      ], [
        question("cafe-story-order", "cafe-order-detail", "cafe-order", "\uAE4C\uBABD\uC774 \uC8FC\uBB38\uD55C \uAC83\uC740 \uBB34\uC5C7\uC774\uC5D0\uC694?", "", ["\uB530\uB73B\uD55C \uCC28 \uC138 \uC794", "\uCC28\uAC00\uC6B4 \uBB3C \uC138 \uC794", "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794"], "a", "\uC774\uC57C\uAE30\uC5D0\uC11C \uAE4C\uBABD\uC740 \uCE5C\uAD6C \uC14B\uC774 \uB9C8\uC2E4 \uB530\uB73B\uD55C \uCC28 \uC138 \uC794\uC744 \uC8FC\uBB38\uD588\uC5B4\uC694.", transfer("\uC8FC\uBB38\uD45C\uC5D0 \uB9DE\uB294 \uC74C\uB8CC\uB97C \uACE8\uB77C\uC694.", "\uC0C8 \uC8FC\uBB38\uD45C: \u201C\uB530\uB73B\uD55C \uC6B0\uC720 \uB450 \uC794 \uC8FC\uC138\uC694.\u201D", ["\uCC28\uAC00\uC6B4 \uC6B0\uC720 \uB450 \uC794", "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794", "\uB530\uB73B\uD55C \uC6B0\uC720 \uB450 \uC794"], "c", "\uC6B0\uC720\xB7\uB530\uB73B\uD55C \uC628\uB3C4\xB7\uB450 \uC794\uC744 \uBAA8\uB450 \uC77D\uC5B4\uC57C \uD574\uC694.")),
        question("cafe-story-here", "cafe-place", "cafe-here", "\u2018\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694\u2019\uB77C\uACE0 \uC801\uC5C8\uC744 \uB54C\uB294 \uC5B4\uB514\uC5D0\uC11C \uB9C8\uC2DC\uB824\uACE0 \uD588\uC5B4\uC694?", "", ["\uAC15\uAC00 \uBCA4\uCE58", "\uCE74\uD398 \uC548", "\uCE5C\uAD6C\uC758 \uC9D1"], "b", "\uCC98\uC74C \uC8FC\uBB38\uD45C\uC758 \u2018\uC5EC\uAE30\uC11C\u2019\uB294 \uCE74\uD398 \uC548\uC744 \uB73B\uD574\uC694.", transfer("\uC8FC\uBB38\uD45C\uB97C \uC77D\uACE0 \uB9C8\uC2E4 \uC7A5\uC18C\uB97C \uACE8\uB77C\uC694.", "\u201C\uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694. \uCC3D\uAC00\uC5D0 \uC549\uC744\uAC8C\uC694.\u201D", ["\uCE74\uD398 \uCC3D\uAC00", "\uAC15\uAC00 \uBCA4\uCE58", "\uC9D1\uC758 \uCC3D\uAC00"], "a", "\u2018\uCE74\uD398 \uC548\u2019\uACFC \u2018\uCC3D\uAC00\u2019\uB97C \uD568\uAED8 \uD655\uC778\uD574\uC694.")),
        question("cafe-story-takeout", "cafe-takeout-request", "cafe-takeout", "\uBC16\uC758 \uBCA4\uCE58\uB85C \uAC00\uAE30 \uC804\uC5D0 \uC9C1\uC6D0\uC5D0\uAC8C \uBD80\uD0C1\uD55C \uB9D0\uC740 \uBB34\uC5C7\uC774\uC5D0\uC694?", "", ["\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uCC28\uB294 \uC548 \uB9C8\uC2E4\uAC8C\uC694.", "\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694."], "c", "\uCE5C\uAD6C\uB4E4\uC740 \uCC28\uB97C \uBC16\uC73C\uB85C \uAC00\uC838\uAC00\uAE30 \uC704\uD574 \uD3EC\uC7A5\uC744 \uC694\uCCAD\uD588\uC5B4\uC694.", transfer("\uC0C8 \uC7A5\uBA74\uC5D0\uC11C \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "\uBE44\uAC00 \uADF8\uCCE4\uC5B4\uC694. \uC74C\uB8CC\uB97C \uAC00\uC9C0\uACE0 \uACF5\uC6D0\uC73C\uB85C \uAC00\uB824\uACE0 \uD574\uC694.", ["\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uB9E4\uC7A5\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uCEF5\uC744 \uBE44\uC6CC \uC8FC\uC138\uC694."], "a", "\uC74C\uB8CC\uB97C \uBC16\uC758 \uACF5\uC6D0\uC73C\uB85C \uAC00\uC838\uAC00\uB824\uBA74 \uD3EC\uC7A5\uC744 \uC694\uCCAD\uD574\uC694."))
      ]),
      lesson("cafe-apply", "apply", "\uB0B4 \uC74C\uB8CC\uB97C \uC8FC\uBB38\uD574\uC694", "\uB2E4\uB978 \uC74C\uB8CC\uC640 \uC7A5\uC18C\uC5D0\uC11C\uB3C4 \uBC30\uC6B4 \uD45C\uD604\uC744 \uC0AC\uC6A9\uD574\uC694.", cafeExpressions, [
        scene("mongle", "\uC624! \uC774\uBC88\uC5D0\uB294 \uC5B4\uB5A4 \uC74C\uB8CC\uC57C? \uAC19\uC774 \uC8FC\uBB38\uD574 \uBCF4\uC790!"),
        scene("kkamong", "\uB0B4\uAC00 \uC54C\uB824 \uC900 \uC8FC\uBB38\uBC95\uC774\uC57C. \uC628\uB3C4\uB791 \uC218\uB97C \uB193\uCE58\uBA74 \uB0B4 \uCEF5\uC774 \uB450 \uAC1C\uAC00 \uB418\uC9C0."),
        scene("marine", "\uC8FC\uBB38 \uD655\uC778. \uD544\uC694\uD55C \uC815\uBCF4\uBD80\uD130 \uC120\uD0DD\uD558\uB77C.")
      ], [
        question("cafe-apply-order", "cafe-order-detail", "cafe-order", "\uC6D0\uD558\uB294 \uC8FC\uBB38\uC744 \uACE8\uB77C\uC694.", "\uCE5C\uAD6C\uC640 \uB458\uC774 \uB9C8\uC2E4 \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB97C \uD55C \uC794\uC529 \uC8FC\uBB38\uD574\uC694.", ["\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uB450 \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uC8FC\uC2A4 \uB450 \uC794 \uC8FC\uC138\uC694."], "b", "\uB458\uC774 \uD55C \uC794\uC529 \uB9C8\uC2DC\uBBC0\uB85C \uB450 \uC794\uC774\uACE0, \uC6D0\uD558\uB294 \uC628\uB3C4\uB294 \uCC28\uAC00\uC6B4 \uC628\uB3C4\uC608\uC694.", transfer("\uC6D0\uD558\uB294 \uC8FC\uBB38\uC744 \uACE8\uB77C\uC694.", "\uD63C\uC790 \uB9C8\uC2E4 \uB530\uB73B\uD55C \uC6B0\uC720 \uD55C \uC794\uC744 \uC8FC\uBB38\uD574\uC694.", ["\uB530\uB73B\uD55C \uC6B0\uC720 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC6B0\uC720 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uC8FC\uC138\uC694."], "a", "\uC6B0\uC720\xB7\uB530\uB73B\uD55C \uC628\uB3C4\xB7\uD55C \uC794\uC5D0 \uB9DE\uB294 \uC8FC\uBB38\uC744 \uC120\uD0DD\uD574\uC694.")),
        question("cafe-apply-here", "cafe-place", "cafe-here", "\uC9C1\uC6D0\uC5D0\uAC8C \uC5B4\uB5BB\uAC8C \uB2F5\uD560\uAE4C\uC694?", "\u201C\uAC00\uC838\uAC00\uC2E4 \uAC74\uAC00\uC694?\u201D \uCE74\uD398 \uC548\uC758 \uD14C\uC774\uBE14\uC5D0\uC11C \uB9C8\uC2DC\uB824\uACE0 \uD574\uC694.", ["\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uC544\uC9C1 \uC548 \uB9C8\uC168\uC5B4\uC694.", "\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694."], "c", "\uD14C\uC774\uBE14\uC5D0\uC11C \uB9C8\uC2DC\uBBC0\uB85C \uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2E0\uB2E4\uACE0 \uB2F5\uD574\uC694.", transfer("\uC9C1\uC6D0\uC5D0\uAC8C \uC5B4\uB5BB\uAC8C \uB2F5\uD560\uAE4C\uC694?", "\u201C\uB9E4\uC7A5\uC5D0\uC11C \uB4DC\uC2DC\uB098\uC694?\u201D \uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2DC\uB824\uACE0 \uD574\uC694.", ["\uC544\uB2C8\uC694, \uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uB124, \uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uB124, \uC9D1\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694."], "b", "\u2018\uB9E4\uC7A5\uC5D0\uC11C\u2019\uB77C\uB294 \uC9C8\uBB38\uC5D0 \uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2E0\uB2E4\uACE0 \uB2F5\uD574\uC694.")),
        question("cafe-apply-takeout", "cafe-takeout-request", "cafe-takeout", "\uC0C1\uD669\uC5D0 \uB9DE\uB294 \uBD80\uD0C1\uC744 \uACE8\uB77C\uC694.", "\uC8FC\uBB38\uD55C \uCC28\uB97C \uAC00\uC9C0\uACE0 \uD559\uAD50\uC5D0 \uAC00\uB824\uACE0 \uD574\uC694.", ["\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uB9E4\uC7A5\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694."], "a", "\uCC28\uB97C \uB2E4\uB978 \uC7A5\uC18C\uB85C \uAC00\uC838\uAC00\uBBC0\uB85C \uD3EC\uC7A5\uC744 \uC694\uCCAD\uD574\uC694.", transfer("\uC0C1\uD669\uC5D0 \uB9DE\uB294 \uBD80\uD0C1\uC744 \uACE8\uB77C\uC694.", "\uCE5C\uAD6C \uC9D1\uC5D0\uC11C \uD568\uAED8 \uB9C8\uC2E4 \uC8FC\uC2A4\uB97C \uCE74\uD398\uC5D0\uC11C \uC0C0\uC5B4\uC694.", ["\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uCEF5\uC740 \uD544\uC694 \uC5C6\uC5B4\uC694.", "\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694."], "c", "\uCE5C\uAD6C \uC9D1\uC73C\uB85C \uAC00\uC838\uAC08 \uC8FC\uC2A4\uC774\uBBC0\uB85C \uD3EC\uC7A5\uC774 \uD544\uC694\uD574\uC694."))
      ]),
      lesson("cafe-visit-taste", "visit", "\uAE4C\uBABD\uC758 \uB530\uB73B\uD55C \uD55C \uC794", "\uCE5C\uAD6C\uC758 \uCDE8\uD5A5\uC744 \uC77D\uACE0 \uD568\uAED8 \uB9C8\uC2E4 \uC74C\uB8CC\uB97C \uC8FC\uBB38\uD574\uC694.", cafeTasteExpressions, [
        scene("narrator", "\uBE44 \uC624\uB294 \uC544\uCE68, \uC138 \uCE5C\uAD6C\uAC00 \uCE74\uD398\uC5D0 \uB2E4\uC2DC \uC654\uC5B4\uC694."),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uBE44\uBC14\uB78C\uB3C4 \uB044\uB5A1\uC5C6\uC9C0. \u2026\uC624\uB298\uC740 \uB530\uB73B\uD55C \uCC28\uAC00 \uB9C8\uC2DC\uACE0 \uC2F6\uAD70."),
        scene("mongle", "\uC624! \uC624\uB298\uC740 \uAE4C\uBABD\uC774 \uC88B\uC544\uD558\uB294 \uAC78\uB85C \uAC19\uC774 \uB9C8\uC154 \uBCFC\uAE4C?"),
        scene("marine", "\uCDE8\uD5A5 \uD655\uC778. \uB530\uB73B\uD55C \uCC28. \uD568\uAED8 \uB9C8\uC2E4 \uC0AC\uB78C, \uB458.")
      ], [
        question("cafe-visit-taste-drink", "cafe-preference-reading", "cafe-preference", "\uAE4C\uBABD\uC774 \uC6D0\uD558\uB294 \uC74C\uB8CC\uB97C \uC8FC\uBB38\uD574\uC694.", "\uAE4C\uBABD: \u201C\uB530\uB73B\uD55C \uCC28\uAC00 \uB9C8\uC2DC\uACE0 \uC2F6\uAD70.\u201D", ["\uB530\uB73B\uD55C \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694."], "b", "\uAE4C\uBABD\uC774 \uC6D0\uD558\uB294 \uC885\uB958\uB294 \uCC28\uC774\uACE0 \uC628\uB3C4\uB294 \uB530\uB73B\uD55C \uC628\uB3C4\uC608\uC694. \uC8FC\uC2A4\uB098 \uCC28\uAC00\uC6B4 \uC74C\uB8CC\uC640 \uAD6C\uBD84\uD574\uC694.", transfer("\uBABD\uAE00\uC774 \uC6D0\uD558\uB294 \uC74C\uB8CC\uB97C \uACE8\uB77C\uC694.", "\uBABD\uAE00: \u201C\uC624\uB298\uC740 \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uAC00 \uB9C8\uC2DC\uACE0 \uC2F6\uC5B4!\u201D", ["\uB530\uB73B\uD55C \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694."], "c", "\uBABD\uAE00\uC758 \uC0C8 \uCDE8\uD5A5\uC740 \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uC608\uC694. \uC6D0\uD558\uB294 \uC885\uB958\uC640 \uC628\uB3C4\uB97C \uD568\uAED8 \uC77D\uC5B4\uC694.")),
        question("cafe-visit-taste-count", "cafe-order-detail", "cafe-order", "\uB458\uC774 \uD55C \uC794\uC529 \uB9C8\uC2DC\uB824\uBA74 \uC5B4\uB5BB\uAC8C \uB9D0\uD560\uAE4C\uC694?", "\uAE4C\uBABD\uACFC \uB0B4\uAC00 \uB530\uB73B\uD55C \uCC28\uB97C \uD55C \uC794\uC529 \uB9C8\uC154\uC694.", ["\uB530\uB73B\uD55C \uCC28 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uCC28 \uC138 \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uC8FC\uC138\uC694."], "c", "\uAE4C\uBABD \uD55C \uC794\uACFC \uB0B4 \uD55C \uC794\uC744 \uD569\uD558\uBA74 \uB450 \uC794\uC774\uC5D0\uC694.", transfer("\uD568\uAED8 \uB9C8\uC2E4 \uC218\uB7C9\uC744 \uC8FC\uBB38\uD574\uC694.", "\uBABD\uAE00\xB7\uAE4C\uBABD\xB7\uB9C8\uB9B0\uC774 \uCC28\uAC00\uC6B4 \uC6B0\uC720\uB97C \uD55C \uC794\uC529 \uB9C8\uC154\uC694.", ["\uCC28\uAC00\uC6B4 \uC6B0\uC720 \uB450 \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC6B0\uC720 \uC138 \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uC6B0\uC720 \uC138 \uC794 \uC8FC\uC138\uC694."], "b", "\uC138 \uC0AC\uB78C\uC774 \uD55C \uC794\uC529 \uB9C8\uC2DC\uBA74 \uC138 \uC794\uC774\uACE0 \uC6D0\uD558\uB294 \uC74C\uB8CC\uB294 \uCC28\uAC00\uC6B4 \uC6B0\uC720\uC608\uC694.")),
        question("cafe-visit-taste-place", "cafe-place", "cafe-here", "\uC9C1\uC6D0\uC5D0\uAC8C \uB9C8\uC2E4 \uACF3\uC744 \uC54C\uB824 \uC8FC\uC138\uC694.", "\uBE44\uAC00 \uADF8\uCE60 \uB54C\uAE4C\uC9C0 \uCE74\uD398 \uC548\uC5D0\uC11C \uB530\uB73B\uD55C \uCC28\uB97C \uB9C8\uC2DC\uBA70 \uC26C\uC5B4\uC694.", ["\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694."], "a", "\uCE74\uD398 \uC548\uC5D0\uC11C \uC26C\uBA74\uC11C \uB9C8\uC2DC\uBBC0\uB85C \uB9E4\uC7A5 \uC774\uC6A9\uC744 \uB9D0\uD574\uC694.", transfer("\uC774\uBC88\uC5D0\uB294 \uC5B4\uB514\uC5D0\uC11C \uB9C8\uC2E4\uAE4C\uC694?", "\uBABD\uAE00\uC774 \uC8FC\uC2A4\uB97C \uAC00\uC9C0\uACE0 \uC9D1\uC5D0 \uAC00\uB824\uACE0 \uD574\uC694. \uC9C1\uC6D0: \u201C\uB9E4\uC7A5\uC5D0\uC11C \uB4DC\uC2DC\uB098\uC694?\u201D", ["\uB124, \uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uC544\uB2C8\uC694, \uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uB124, \uCC3D\uAC00\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694."], "b", "\uC0C8 \uC7A5\uBA74\uC740 \uC9D1\uC5D0 \uAC00\uC838\uAC00\uB294 \uC8FC\uBB38\uC774\uC5D0\uC694. \uB9E4\uC7A5 \uC774\uC6A9 \uB300\uC2E0 \uD3EC\uC7A5\uC744 \uBD80\uD0C1\uD574\uC694."))
      ]),
      lesson("cafe-visit-soldout", "visit", "\uC8FC\uC2A4\uAC00 \uC5C6\uB294 \uB0A0", "\uD488\uC808 \uC548\uB0B4\uB97C \uC77D\uACE0 \uAC00\uB2A5\uD55C \uC74C\uB8CC\uB85C \uC8FC\uBB38\uC744 \uC774\uC5B4\uAC00\uC694.", cafeSoldoutExpressions, [
        scene("narrator", "\uCE74\uD398\uC758 \uC791\uC740 \uC548\uB0B4\uD310: \u201C\uC624\uB298 \uC8FC\uC2A4 \uD488\uC808. \uB530\uB73B\uD55C \uCC28\uB294 \uC8FC\uBB38\uD560 \uC218 \uC788\uC5B4\uC694.\u201D"),
        scene("mongle", "\uC5B4? \uC8FC\uC2A4\uAC00 \uB2E4 \uB098\uAC14\uB124! \uAC19\uC774 \uB2E4\uB978 \uC74C\uB8CC\uB97C \uCC3E\uC544\uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uCC28\uB3C4 \uC798 \uACE0\uB974\uC9C0. \uC6D0\uB798 \uCC28\uB97C \uB9C8\uC2E4 \uC0DD\uAC01\uB3C4\u2026 \uC788\uC5C8\uC5B4."),
        scene("marine", "\uC8FC\uBB38 \uAC00\uB2A5 \uD655\uC778. \uB530\uB73B\uD55C \uCC28. \uACF5\uC6D0\uC73C\uB85C \uAC00\uC838\uAC08 \uD55C \uC794.")
      ], [
        question("cafe-visit-soldout-menu", "cafe-availability", "cafe-soldout", "\uC9C0\uAE08 \uC8FC\uBB38\uD560 \uC218 \uC788\uB294 \uC74C\uB8CC\uB97C \uACE8\uB77C\uC694.", "\uC624\uB298 \uC8FC\uC2A4 \uD488\uC808. \uB530\uB73B\uD55C \uCC28\uB294 \uC8FC\uBB38\uD560 \uC218 \uC788\uC5B4\uC694.", ["\uB530\uB73B\uD55C \uCC28 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694."], "a", "\uC8FC\uC2A4\uB294 \uD488\uC808\uC774\uB77C \uC628\uB3C4\uB97C \uBC14\uAFB8\uC5B4\uB3C4 \uC8FC\uBB38\uD560 \uC218 \uC5C6\uC5B4\uC694. \uAC00\uB2A5\uD55C \uC74C\uB8CC\uB294 \uB530\uB73B\uD55C \uCC28\uC608\uC694.", transfer("\uC0C8 \uC548\uB0B4\uD310\uC5D0\uC11C \uC8FC\uBB38\uD560 \uC218 \uC788\uB294 \uC74C\uB8CC\uB97C \uACE8\uB77C\uC694.", "\uC624\uB298 \uC6B0\uC720 \uD488\uC808. \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB294 \uC8FC\uBB38\uD560 \uC218 \uC788\uC5B4\uC694.", ["\uB530\uB73B\uD55C \uC6B0\uC720 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC6B0\uC720 \uD55C \uC794 \uC8FC\uC138\uC694."], "b", "\uC774\uBC88\uC5D0\uB294 \uC6B0\uC720\uAC00 \uD488\uC808\uC774\uACE0 \uC8FC\uC2A4\uB294 \uC8FC\uBB38\uD560 \uC218 \uC788\uC5B4\uC694. \uC0C8 \uC548\uB0B4\uB97C \uC77D\uACE0 \uACE8\uB77C\uC694.")),
        question("cafe-visit-soldout-count", "cafe-order-detail", "cafe-order", "\uC9C1\uC6D0\uC774 \uC218\uB7C9\uC744 \uB2E4\uC2DC \uBB3C\uC5B4\uC694. \uC5B4\uB5BB\uAC8C \uB2F5\uD560\uAE4C\uC694?", "\uD63C\uC790 \uB9C8\uC2E4 \uD55C \uC794\uC744 \uC8FC\uBB38\uD588\uC5B4\uC694. \uC9C1\uC6D0: \u201C\uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uB9DE\uC73C\uC2DC\uC8E0?\u201D", ["\uC138 \uC794 \uC8FC\uC138\uC694.", "\uB124, \uB450 \uC794 \uC8FC\uC138\uC694.", "\uC544\uB2C8\uC694, \uD55C \uC794 \uC8FC\uC138\uC694."], "c", "\uD544\uC694\uD55C \uAC83\uC740 \uD55C \uC794\uC774\uC5D0\uC694. \uC9C1\uC6D0\uC758 \uB450 \uC794 \uD655\uC778\uC5D0 \uC544\uB2C8\uC694\uB77C\uACE0 \uB2F5\uD558\uACE0 \uD55C \uC794\uC744 \uB9D0\uD574\uC694.", transfer("\uC0C8 \uC8FC\uBB38\uC758 \uC218\uB7C9\uC744 \uB2E4\uC2DC \uC54C\uB824 \uC8FC\uC138\uC694.", "\uCE5C\uAD6C\uC640 \uB458\uC774 \uD55C \uC794\uC529 \uB9C8\uC154\uC694. \uC9C1\uC6D0: \u201C\uC8FC\uC2A4 \uD55C \uC794 \uB9DE\uC73C\uC2DC\uC8E0?\u201D", ["\uB124, \uD55C \uC794 \uC8FC\uC138\uC694.", "\uC544\uB2C8\uC694, \uB450 \uC794 \uC8FC\uC138\uC694.", "\uC544\uB2C8\uC694, \uC138 \uC794 \uC8FC\uC138\uC694."], "b", "\uC774\uBC88 \uC8FC\uBB38\uC740 \uB450 \uC0AC\uB78C\uC774 \uD55C \uC794\uC529 \uB9C8\uC2E4 \uB450 \uC794\uC774\uC5D0\uC694. \uD55C \uC794\uC774\uB77C\uB294 \uD655\uC778\uC744 \uACE0\uCCD0\uC694.")),
        question("cafe-visit-soldout-takeout", "cafe-takeout-request", "cafe-takeout", "\uACF5\uC6D0\uC73C\uB85C \uAC00\uC838\uAC00\uB824\uBA74 \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "\uB530\uB73B\uD55C \uCC28\uB97C \uAC00\uC9C0\uACE0 \uACF5\uC6D0 \uBCA4\uCE58\uB85C \uAC00\uB824\uACE0 \uD574\uC694.", ["\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694."], "b", "\uCE74\uD398 \uBC16\uC758 \uACF5\uC6D0\uC5D0 \uAC00\uC838\uAC08 \uCC28\uC774\uBBC0\uB85C \uD3EC\uC7A5\uC744 \uBD80\uD0C1\uD574\uC694.", transfer("\uC0C8 \uC7A5\uBA74\uC5D0\uC11C \uB9C8\uC2E4 \uACF3\uC744 \uC54C\uB824 \uC8FC\uC138\uC694.", "\uBE44\uAC00 \uB9CE\uC774 \uC640\uC11C \uCE74\uD398 \uC548\uC758 \uD14C\uC774\uBE14\uC5D0\uC11C \uC8FC\uC2A4\uB97C \uB9C8\uC2DC\uB824\uACE0 \uD574\uC694.", ["\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uCDE8\uC18C\uD574 \uC8FC\uC138\uC694.", "\uB9E4\uC7A5\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694."], "c", "\uC774\uBC88\uC5D0\uB294 \uBC16\uC73C\uB85C \uAC00\uC838\uAC00\uC9C0 \uC54A\uACE0 \uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2DC\uBBC0\uB85C \uB9E4\uC7A5 \uC774\uC6A9\uC744 \uB9D0\uD574\uC694."))
      ]),
      lesson("cafe-visit-change", "visit", "\uAE4C\uBABD\uC758 \uB9C8\uC74C\uC774 \uBC14\uB00C\uC5C8\uC5B4\uC694", "\uC74C\uB8CC\xB7\uC218\uB7C9\xB7\uD3EC\uC7A5\uC744 \uBC14\uAFD4 \uB2EC\uB77C\uACE0 \uBD80\uD0C1\uD574\uC694.", cafeChangeExpressions, [
        scene("narrator", "\uC8FC\uBB38\uD45C\uC5D0\uB294 \uB530\uB73B\uD55C \uC8FC\uC2A4 \uB450 \uC794\uC774 \uC801\uD600 \uC788\uC5B4\uC694. \uC544\uC9C1 \uC74C\uB8CC\uB97C \uB9CC\uB4E4\uAE30 \uC804\uC774\uC5D0\uC694."),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uB530\uB73B\uD55C \uCC28\uAC00 \uB354 \uB04C\uB9AC\uB294\uAD70. \u2026\uC9C0\uAE08 \uBC14\uAFC0 \uC218 \uC788\uACA0\uC9C0."),
        scene("mongle", "\uC624! \uB9C8\uB9B0\uB3C4 \uAC19\uC774 \uB9C8\uC2E0\uB300! \uD55C \uC794 \uB354 \uCC59\uACA8\uC11C \uACF5\uC6D0\uC73C\uB85C \uAC08\uAE4C?"),
        scene("marine", "\uBCC0\uACBD \uC900\uBE44. \uCC28\uB85C \uAD50\uCCB4, \uD55C \uC794 \uCD94\uAC00, \uC804\uC6D0 \uACF5\uC6D0\uC73C\uB85C \uC774\uB3D9.")
      ], [
        question("cafe-visit-change-drink", "cafe-order-change", "cafe-change", "\uC8FC\uC2A4\uB97C \uB530\uB73B\uD55C \uCC28\uB85C \uBC14\uAFB8\uC5B4 \uB2EC\uB77C\uACE0 \uB9D0\uD574\uC694.", "\uC544\uC9C1 \uB9CC\uB4E4\uAE30 \uC804\uC778 \uB530\uB73B\uD55C \uC8FC\uC2A4 \uB450 \uC794\uC744 \uB530\uB73B\uD55C \uCC28 \uB450 \uC794\uC73C\uB85C \uBC14\uAFB8\uB824\uACE0 \uD574\uC694.", ["\uC8FC\uC2A4 \uB300\uC2E0 \uB530\uB73B\uD55C \uCC28\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uC8FC\uC2A4\uB85C \uC900\uBE44\uD574 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694."], "a", "\uC8FC\uC2A4 \uB300\uC2E0\uC774\uB77C\uB294 \uB9D0\uB85C \uC774\uC804 \uC74C\uB8CC\uB97C \uC9DA\uACE0 \uB530\uB73B\uD55C \uCC28\uB85C \uBC14\uAFD4 \uB2EC\uB77C\uACE0 \uBD80\uD0C1\uD574\uC694.", transfer("\uC774\uBC88\uC5D0\uB294 \uCC28\uB97C \uC8FC\uC2A4\uB85C \uBC14\uAFB8\uACE0 \uC2F6\uC5B4\uC694.", "\uC544\uC9C1 \uB9CC\uB4E4\uAE30 \uC804\uC778 \uB530\uB73B\uD55C \uCC28 \uD55C \uC794\uC744 \uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794\uC73C\uB85C \uBC14\uAFB8\uB824\uACE0 \uD574\uC694.", ["\uB530\uB73B\uD55C \uCC28\uB85C \uC900\uBE44\uD574 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uCC28\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694.", "\uCC28 \uB300\uC2E0 \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694."], "c", "\uC0C8 \uC8FC\uBB38\uC740 \uB530\uB73B\uD55C \uCC28\uC5D0\uC11C \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB85C \uBCC0\uACBD\uD558\uB294 \uAC83\uC774\uC5D0\uC694. \uBC14\uAFC0 \uC885\uB958\uC640 \uC628\uB3C4\uB97C \uD655\uC778\uD574\uC694.")),
        question("cafe-visit-change-count", "cafe-order-detail", "cafe-add", "\uB9C8\uB9B0\uC758 \uCEF5 \uD55C \uC794\uC744 \uCD94\uAC00\uD574\uC694.", "\uD604\uC7AC \uB530\uB73B\uD55C \uCC28 \uB450 \uC794\uC744 \uC8FC\uBB38\uD588\uC5B4\uC694. \uC138 \uCE5C\uAD6C\uAC00 \uD55C \uC794\uC529 \uB9C8\uC2E4 \uC138 \uC794\uC774 \uD544\uC694\uD574\uC694.", ["\uD55C \uC794 \uBE7C \uC8FC\uC138\uC694.", "\uD55C \uC794 \uB354 \uC8FC\uC138\uC694.", "\uADF8\uB300\uB85C \uB450 \uC794 \uC8FC\uC138\uC694."], "b", "\uB450 \uC794\uC5D0 \uD55C \uC794 \uB354 \uCD94\uAC00\uD558\uBA74 \uC138 \uC794\uC774\uC5D0\uC694. \uB354\uB294 \uC218\uB7C9\uC744 \uB298\uB9AC\uB294 \uB9D0\uC774\uC5D0\uC694.", transfer("\uC0C8 \uC8FC\uBB38\uC5D0 \uCE5C\uAD6C\uC758 \uCEF5\uC744 \uCD94\uAC00\uD574\uC694.", "\uD604\uC7AC \uC8FC\uC2A4 \uD55C \uC794\uC744 \uC8FC\uBB38\uD588\uC5B4\uC694. \uCE5C\uAD6C\uC640 \uB458\uC774 \uD55C \uC794\uC529 \uB9C8\uC2DC\uB824\uBA74 \uB450 \uC794\uC774 \uD544\uC694\uD574\uC694.", ["\uD55C \uC794 \uBE7C \uC8FC\uC138\uC694.", "\uD55C \uC794 \uB354 \uC8FC\uC138\uC694.", "\uADF8\uB300\uB85C \uD55C \uC794 \uC8FC\uC138\uC694."], "b", "\uD55C \uC794\uC5D0 \uD55C \uC794\uC744 \uB354\uD558\uBA74 \uB450 \uC794\uC774\uC5D0\uC694. \uC0C8 \uC2DC\uC791 \uC218\uB7C9\uC744 \uC77D\uACE0 \uCD94\uAC00\uD574\uC694.")),
        question("cafe-visit-change-place", "cafe-takeout-request", "cafe-takeout", "\uB9E4\uC7A5 \uC774\uC6A9\uC744 \uD3EC\uC7A5\uC73C\uB85C \uBC14\uAFB8\uC5B4\uC694.", "\uCC98\uC74C\uC5D0\uB294 \uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2DC\uAE30\uB85C \uD588\uC9C0\uB9CC, \uC774\uC81C \uC74C\uB8CC\uB97C \uAC00\uC9C0\uACE0 \uACF5\uC6D0\uC5D0 \uAC00\uB824\uACE0 \uD574\uC694.", ["\uADF8\uB300\uB85C \uB9E4\uC7A5\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694.", "\uD3EC\uC7A5\uC73C\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694."], "c", "\uC74C\uB8CC\uB294 \uC720\uC9C0\uD558\uACE0 \uBC16\uC73C\uB85C \uAC00\uC838\uAC00\uBBC0\uB85C \uB9E4\uC7A5 \uC774\uC6A9\uC5D0\uC11C \uD3EC\uC7A5\uC73C\uB85C \uBC14\uAFD4 \uB2EC\uB77C\uACE0 \uBD80\uD0C1\uD574\uC694.", transfer("\uC774\uBC88\uC5D0\uB294 \uD3EC\uC7A5\uC744 \uB9E4\uC7A5 \uC774\uC6A9\uC73C\uB85C \uBC14\uAFB8\uC5B4\uC694.", "\uC8FC\uC2A4\uB97C \uC9D1\uC5D0 \uAC00\uC838\uAC00\uAE30\uB85C \uD588\uC9C0\uB9CC, \uCE5C\uAD6C\uB97C \uB9CC\uB098 \uCE74\uD398 \uC548\uC5D0\uC11C \uD568\uAED8 \uB9C8\uC2DC\uB824\uACE0 \uD574\uC694.", ["\uB9E4\uC7A5 \uC774\uC6A9\uC73C\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694.", "\uADF8\uB300\uB85C \uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694."], "a", "\uC774\uBC88 \uBCC0\uACBD \uBC29\uD5A5\uC740 \uD3EC\uC7A5\uC5D0\uC11C \uB9E4\uC7A5 \uC774\uC6A9\uC774\uC5D0\uC694. \uC0C8\uB85C \uB9C8\uC2E4 \uC7A5\uC18C\uC5D0 \uB9DE\uAC8C \uB9D0\uD574\uC694."))
      ]),
      lesson("cafe-compose", "compose", "\uB0B4 \uB9D0\uB85C \uC8FC\uBB38\uD574\uC694", "\uC74C\uB8CC\xB7\uC628\uB3C4\xB7\uC218\uB7C9\uC744 \uACE8\uB77C \uC8FC\uBB38 \uBB38\uC7A5\uC744 \uC644\uC131\uD574\uC694.", cafeComposeExpressions, [
        scene("narrator", "\uC774\uC81C \uC8FC\uBB38 \uBB38\uC7A5\uC744 \uC9C1\uC811 \uB9CC\uB4E4\uC5B4 \uBCFC \uC2DC\uAC04\uC774\uC5D0\uC694. \uAE4C\uBABD\uACFC \uB458\uC774 \uB530\uB73B\uD55C \uCC28\uB97C \uD55C \uC794\uC529 \uB9C8\uC154\uC694."),
        scene("mongle", "\uC624! \uB2E8\uC5B4\uB97C \uACE8\uB790\uB354\uB2C8 \uB124 \uC8FC\uBB38\uC774 \uB418\uB124! \uAC19\uC774 \uB9CC\uB4E4\uC5B4 \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8 \uCEF5\uB3C4 \uCC59\uACA8 \uC918. \u2026\uB530\uB73B\uD55C \uCC28, \uD55C \uC794\uC774\uBA74 \uB3FC."),
        scene("marine", "\uC8FC\uBB38 \uC815\uBCF4 \uD655\uC778. \uCC28, \uB530\uB73B\uD55C \uC628\uB3C4, \uB450 \uC794.")
      ], [
        { ...question("cafe-compose-order", "cafe-compose-order", "cafe-compose", "\uAE4C\uBABD\uACFC \uB9C8\uC2E4 \uB530\uB73B\uD55C \uCC28 \uB450 \uC794\uC744 \uC8FC\uBB38\uD574\uC694.", "\uAE4C\uBABD\uACFC \uB0B4\uAC00 \uB530\uB73B\uD55C \uCC28\uB97C \uD55C \uC794\uC529 \uB9C8\uC154\uC694. \uC74C\uB8CC\xB7\uC628\uB3C4\xB7\uC794 \uC218\uB97C \uC9C1\uC811 \uACE8\uB77C \uC8FC\uC138\uC694.", ["\uC8FC\uBB38 \uC870\uAC74\uC744 \uBAA8\uB450 \uB9DE\uCDC4\uC5B4\uC694.", "\uD544\uC694\uD55C \uC218\uB7C9\uACFC \uB2EC\uB77C\uC694.", "\uC74C\uB8CC\uB098 \uC628\uB3C4\uAC00 \uB2EC\uB77C\uC694."], "a", "\uC74C\uB8CC\uB294 \uCC28, \uC628\uB3C4\uB294 \uB530\uB73B\uD558\uAC8C, \uC218\uB7C9\uC740 \uB450 \uC794\uC774\uC5D0\uC694. \uC138 \uC815\uBCF4\uB97C \uC5F0\uACB0\uD558\uBA74 \uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uC8FC\uC138\uC694\uAC00 \uB3FC\uC694.", transfer("\uC644\uC131\uD560 \uC8FC\uBB38 \uBB38\uC7A5\uC744 \uACE8\uB77C\uC694.", "\uBABD\uAE00\xB7\uAE4C\uBABD\xB7\uB9C8\uB9B0\uC774 \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB97C \uD55C \uC794\uC529 \uB9C8\uC154\uC694.", ["\uB530\uB73B\uD55C \uC8FC\uC2A4 \uC138 \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uCC28 \uB450 \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uC138 \uC794 \uC8FC\uC138\uC694."], "c", "\uC8FC\uC2A4\xB7\uCC28\uAC00\uC6B4 \uC628\uB3C4\xB7\uC138 \uC794\uC744 \uBAA8\uB450 \uB2F4\uC544\uC57C \uC0C8 \uC8FC\uBB38\uC5D0 \uB9DE\uC544\uC694.")), kind: "compose", orderGoal: { drink: "tea", temperature: "warm", count: 2 } },
        question("cafe-compose-count", "cafe-order-detail", "cafe-order", "\uC9C1\uC6D0\uC758 \uC218\uB7C9 \uD655\uC778\uC5D0 \uB2F5\uD574\uC694.", "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794\uC744 \uC8FC\uBB38\uD588\uC5B4\uC694. \uC9C1\uC6D0: \u201C\uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uB9DE\uC73C\uC2DC\uC8E0?\u201D", ["\uC544\uB2C8\uC694, \uD55C \uC794 \uC8FC\uC138\uC694.", "\uB124, \uB450 \uC794 \uC8FC\uC138\uC694.", "\uC544\uB2C8\uC694, \uC138 \uC794 \uC8FC\uC138\uC694."], "b", "\uC6D0\uD558\uB294 \uC218\uB7C9\uACFC \uC9C1\uC6D0\uC774 \uD655\uC778\uD55C \uC218\uB7C9\uC774 \uBAA8\uB450 \uB450 \uC794\uC774\uC5D0\uC694. \uB124\uB77C\uACE0 \uB2F5\uD558\uACE0 \uB450 \uC794\uC744 \uD655\uC778\uD574\uC694.", transfer("\uC0C8 \uC8FC\uBB38\uC758 \uC218\uB7C9\uC744 \uD655\uC778\uD574\uC694.", "\uD63C\uC790 \uB9C8\uC2E4 \uCC28\uAC00\uC6B4 \uCC28 \uD55C \uC794\uC744 \uC8FC\uBB38\uD588\uC5B4\uC694. \uC9C1\uC6D0: \u201C\uB450 \uC794 \uB9DE\uC73C\uC2DC\uC8E0?\u201D", ["\uB124, \uB450 \uC794 \uC8FC\uC138\uC694.", "\uC544\uB2C8\uC694, \uD55C \uC794 \uC8FC\uC138\uC694.", "\uC544\uB2C8\uC694, \uC138 \uC794 \uC8FC\uC138\uC694."], "b", "\uC774\uBC88\uC5D0\uB294 \uD55C \uC794\uC774 \uD544\uC694\uD558\uBBC0\uB85C \uB450 \uC794\uC774\uB77C\uB294 \uD655\uC778\uC744 \uD55C \uC794\uC73C\uB85C \uACE0\uCCD0\uC694.")),
        question("cafe-compose-place", "cafe-place", "cafe-here", "\uD568\uAED8 \uB9C8\uC2E4 \uC790\uB9AC\uB97C \uC815\uD574\uC694.", "\uAE4C\uBABD\uACFC \uCE74\uD398 \uC548\uC5D0\uC11C \uB530\uB73B\uD55C \uCC28\uB97C \uB9C8\uC2DC\uBA70 \uC26C\uB824\uACE0 \uD574\uC694.", ["\uB124, \uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uC544\uB2C8\uC694, \uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694."], "a", "\uCE74\uD398 \uC548\uC5D0\uC11C \uD568\uAED8 \uB9C8\uC2DC\uB824\uBA74 \uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694\uB85C \uB9E4\uC7A5 \uC774\uC6A9\uC744 \uB9D0\uD574\uC694.", transfer("\uC0C8 \uC7A5\uBA74\uC5D0\uC11C \uB9C8\uC2E4 \uACF3\uC744 \uC54C\uB824\uC694.", "\uB9C8\uB9B0\uC774 \uCC28\uB97C \uAC00\uC9C0\uACE0 \uD559\uAD50\uC5D0 \uAC00\uB824\uACE0 \uD574\uC694. \uC9C1\uC6D0: \u201C\uB9E4\uC7A5\uC5D0\uC11C \uB4DC\uC2DC\uB098\uC694?\u201D", ["\uB124, \uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694.", "\uC544\uB2C8\uC694, \uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694."], "c", "\uC774\uBC88\uC5D0\uB294 \uD559\uAD50\uB85C \uAC00\uC838\uAC00\uBBC0\uB85C \uB9E4\uC7A5 \uC774\uC6A9 \uB300\uC2E0 \uD3EC\uC7A5\uC744 \uBD80\uD0C1\uD574\uC694."))
      ])
    ]
  },
  {
    id: "store",
    title: "\uAE4C\uBABD\uC758 \uD3B8\uC758\uC810 \uC791\uC804",
    subtitle: "\uAC00\uACA9\uC744 \uBB3B\uACE0 \uBB3C\uAC74\uC744 \uC0AC\uC694",
    icon: "store",
    level: "\uAE30\uCD08 \uC0DD\uD65C \uD55C\uAD6D\uC5B4",
    skills: [skill("store-price-reading", "\uAC00\uACA9 \uC9C8\uBB38\uACFC \uD45C\uC2DC \uC77D\uAE30"), skill("store-bag-request", "\uBD09\uD22C \uC694\uCCAD\uD558\uAE30"), skill("store-payment", "\uACB0\uC81C \uBC29\uBC95 \uC774\uD574\uD558\uAE30")],
    lessons: [
      lesson("store-expressions", "expressions", "\uACC4\uC0B0\uB300 \uC55E \uC138 \uB9C8\uB514", "\uAC00\uACA9\xB7\uBD09\uD22C\xB7\uCE74\uB4DC \uACB0\uC81C\uB97C \uAD6C\uBD84\uD574\uC694.", storeExpressions, [
        scene("mongle", "\uC6B0\uC640! \uC791\uC740 \uAC00\uAC8C\uC5D0 \uBB3C\uAC74\uC774 \uAC00\uB4DD\uD574! \uAC19\uC774 \uACE8\uB77C \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uAC00\uACA9\uB3C4 \uC54C\uC544\uBCF4\uC9C0. \uC22B\uC790\uAC00 \uC791\u2026 \uC544\uB2C8, \uAC00\uAE4C\uC774\uC11C \uC77D\uB294 \uAC70\uC57C."),
        scene("marine", "\uAD6C\uB9E4 \uC900\uBE44. \uAC00\uACA9, \uBD09\uD22C, \uACB0\uC81C \uBC29\uBC95 \uD655\uC778.")
      ], [
        question("store-expressions-price", "store-price-reading", "store-price", "\uBB3C\uAC74\uC758 \uAC00\uACA9\uC744 \uC54C\uACE0 \uC2F6\uC5B4\uC694. \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "", ["\uC774\uAC70 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uC774\uAC70 \uBA87 \uAC1C\uC608\uC694?", "\uC774\uAC70 \uC5BC\uB9C8\uC608\uC694?"], "c", "\uAC00\uACA9\uC744 \uBB3C\uC744 \uB54C\uB294 \u2018\uC5BC\uB9C8\uC608\uC694\u2019\uB97C \uC0AC\uC6A9\uD574\uC694.", transfer("\uC774 \uC0CC\uB4DC\uC704\uCE58\uC758 \uAC12\uC744 \uBB3C\uC5B4\uBCF4\uB824\uACE0 \uD574\uC694.", "", ["\uC774\uAC70 \uC5BC\uB9C8\uC608\uC694?", "\uC774\uAC70 \uC5B8\uC81C \uBA39\uC5B4\uC694?", "\uC774\uAC70 \uB204\uAD6C \uAC70\uC608\uC694?"], "a", "\uBB3C\uAC74\uC758 \uAC12\uC740 \u2018\uC5BC\uB9C8\uC608\uC694\u2019\uB85C \uBB3C\uC5B4\uC694.")),
        question("store-expressions-bag", "store-bag-request", "store-bag", "\u2018\uBD09\uD22C \uD558\uB098 \uC8FC\uC138\uC694\u2019\uB294 \uBB34\uC5C7\uC744 \uBD80\uD0C1\uD558\uB294 \uB9D0\uC774\uC5D0\uC694?", "\uC0B0 \uBB3C\uAC74\uC744 \uBC16\uC73C\uB85C \uAC00\uC838\uAC00\uB824\uACE0 \uD574\uC694.", ["\uBB3C\uAC74\uC758 \uAC00\uACA9", "\uBB3C\uAC74\uC744 \uB2F4\uC744 \uBD09\uD22C", "\uD604\uAE08\uC73C\uB85C \uACB0\uC81C\uD558\uAE30"], "b", "\u2018\uBD09\uD22C\u2019\uB294 \uC0B0 \uBB3C\uAC74\uC744 \uB2F4\uC544 \uAC00\uC838\uAC00\uB294 \uB370 \uC0AC\uC6A9\uD574\uC694.", transfer("\uC9C1\uC6D0\uC5D0\uAC8C \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "\uC6B0\uC720\uC640 \uBE75\uC744 \uD55C\uAEBC\uBC88\uC5D0 \uB2F4\uC544 \uAC00\uC838\uAC08 \uBD09\uD22C\uAC00 \uD544\uC694\uD574\uC694.", ["\uBD09\uD22C \uD558\uB098 \uC8FC\uC138\uC694.", "\uC6B0\uC720 \uD558\uB098 \uB354 \uC8FC\uC138\uC694.", "\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694."], "a", "\uBB3C\uAC74\uC744 \uB2F4\uC744 \uBD09\uD22C\uAC00 \uD544\uC694\uD558\uBBC0\uB85C \uBD09\uD22C\uB97C \uC694\uCCAD\uD574\uC694.")),
        question("store-expressions-card", "store-payment", "store-card", "\u2018\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694\u2019\uB294 \uC5B4\uB5BB\uAC8C \uAC12\uC744 \uB0B4\uACA0\uB2E4\uB294 \uB9D0\uC774\uC5D0\uC694?", "", ["\uCE74\uB4DC\uB85C \uB0B4\uC694.", "\uD604\uAE08\uC73C\uB85C \uB0B4\uC694.", "\uB2E4\uC74C\uC5D0 \uB0B4\uC694."], "a", "\u2018\uCE74\uB4DC\uB85C\u2019\uB294 \uCE74\uB4DC\uB77C\uB294 \uBC29\uBC95\uC744 \uC774\uC6A9\uD55C\uB2E4\uB294 \uB73B\uC774\uC5D0\uC694.", transfer("\u2018\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694\u2019\uB294 \uC5B4\uB5BB\uAC8C \uAC12\uC744 \uB0B4\uACA0\uB2E4\uB294 \uB9D0\uC774\uC5D0\uC694?", "", ["\uCE74\uB4DC\uB85C \uB0B4\uC694.", "\uB0B4\uC77C \uB0B4\uC694.", "\uD604\uAE08\uC73C\uB85C \uB0B4\uC694."], "c", "\uC9C0\uD3D0\uB098 \uB3D9\uC804\uC73C\uB85C \uC9C1\uC811 \uAC12\uC744 \uB0B4\uB294 \uBC29\uBC95\uC740 \uD604\uAE08 \uACB0\uC81C\uC608\uC694."))
      ]),
      lesson("store-story", "story", "\uBB3C\uC740 \uC6D0\uB798 \uC900\uBE44\uD558\uB294 \uAC70\uC57C", "\uAC00\uACA9\uD45C\uC640 \uC138 \uCE5C\uAD6C\uC758 \uAD6C\uB9E4\uB97C \uC77D\uACE0 \uC774\uD574\uD574\uC694.", storeExpressions, [
        scene("narrator", "\uC138 \uCE5C\uAD6C\uAC00 \uD3B8\uC758\uC810\uC5D0\uC11C \uAC04\uC2DD\uC744 \uACE8\uB77C\uC694. \uBB3C \uD55C \uBCD1\uC758 \uAC00\uACA9\uD45C\uC5D0\uB294 1,000\uC6D0\uC774\uB77C\uACE0 \uC801\uD600 \uC788\uC5B4\uC694."),
        scene("mongle", "\uC6B0\uC640! \uB77C\uBA74 \uBD09\uC9C0\uAC00 \uBE68\uAC1C! \uAC19\uC774 \uC800 \uADF8\uB9BC \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uB9E4\uC6B4 \uB77C\uBA74\uB3C4 \uC798 \uBA39\uC9C0. \uBB3C\uC740\u2026 \uB098 \uB9D0\uACE0 \uB108\uD76C\uAC00 \uB9C8\uC2DC\uB77C\uACE0."),
        scene("marine", "\uBCF4\uAE09 \uD655\uC778. \uBB3C \uD55C \uBCD1, \uCC9C \uC6D0. \u2026\uB9E4\uC6B8 \uB54C \uB9C8\uC154\uB77C."),
        scene("narrator", "\uB9C8\uB9B0\uC740 \uB77C\uBA74\uACFC \uBB3C\uC744 \uB2F4\uC73C\uB824\uACE0 \uC9C1\uC6D0\uC5D0\uAC8C \u2018\uBD09\uD22C \uD558\uB098 \uC8FC\uC138\uC694\u2019\uB77C\uACE0 \uBD80\uD0C1\uD574\uC694."),
        scene("mongle", "\uC624! \uBB3C\uC774 \uB118\uC5B4\uC9C0\uC9C0 \uC54A\uAC8C \uC138\uC6CC \uC92C\uB124! \uAC19\uC774 \uAC00\uC838\uAC00\uC790!"),
        scene("kkamong", "\uACC4\uC0B0\uC740 \uC774 \uBAB8\uC774 \uD558\uC9C0. \u2018\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694.\u2019"),
        scene("narrator", "\uAE4C\uBABD\uC740 \uCE74\uB4DC\uB85C \uACC4\uC0B0\uD558\uACE0 \uBD09\uD22C\uB97C \uCC59\uACA8\uC694. \uB9C8\uB8E8\uC5D0 \uB3CC\uC544\uC640 \uB77C\uBA74\uC744 \uD55C\uC785 \uBA39\uC5B4\uC694."),
        scene("kkamong", "\uB0B4\uAC00 \uC6D0\uB798 \uBB3C\uB3C4 \uC88B\uC544\uD558\uAC70\uB4E0. \u2026\uD55C \uBAA8\uAE08\uB9CC."),
        scene("marine", "\uBCF4\uAE09 \uC644\uB8CC. \uBB3C, \uC5EC\uAE30. \uC804\uC6D0 \uAC04\uC2DD \uD655\uC778.")
      ], [
        question("store-story-price", "store-price-reading", "store-price", "\uC774\uC57C\uAE30 \uC18D \uBB3C \uD55C \uBCD1\uC740 \uC5BC\uB9C8\uC608\uC694?", "", ["2,000\uC6D0", "1,000\uC6D0", "3,000\uC6D0"], "b", "\uBB3C \uD55C \uBCD1\uC758 \uAC00\uACA9\uD45C\uC5D0 1,000\uC6D0\uC774\uB77C\uACE0 \uC801\uD600 \uC788\uC5B4\uC694.", transfer("\uC0C8 \uAC00\uACA9\uD45C\uB97C \uC77D\uC5B4\uC694. \uC6B0\uC720 \uD55C \uAC1C\uB294 \uC5BC\uB9C8\uC608\uC694?", "\uC6B0\uC720 \uD55C \uAC1C 1,500\uC6D0 / \uBE75 \uD55C \uAC1C 2,000\uC6D0", ["2,000\uC6D0", "3,500\uC6D0", "1,500\uC6D0"], "c", "\uC6B0\uC720 \uAC00\uACA9\uC740 1,500\uC6D0\uC774\uC5D0\uC694. \uB2E4\uB978 \uBB3C\uAC74\uC774\uB098 \uD569\uACC4\uC640 \uAD6C\uBD84\uD574\uC694.")),
        question("store-story-bag", "store-bag-request", "store-bag", "\uB9C8\uB9B0\uC774 \uBD09\uD22C\uB97C \uBD80\uD0C1\uD55C \uC774\uC720\uB294 \uBB34\uC5C7\uC774\uC5D0\uC694?", "", ["\uB77C\uBA74\uACFC \uBB3C\uC744 \uB2F4\uC73C\uB824\uACE0\uC694.", "\uAC00\uACA9\uC744 \uBC14\uAFB8\uB824\uACE0\uC694.", "\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD558\uB824\uACE0\uC694."], "a", "\uB9C8\uB9B0\uC740 \uC0B0 \uB77C\uBA74\uACFC \uBB3C\uC744 \uD568\uAED8 \uB2F4\uC544 \uAC00\uC838\uAC00\uB824\uACE0 \uBD09\uD22C\uB97C \uBD80\uD0C1\uD588\uC5B4\uC694.", transfer("\uBD09\uD22C\uB97C \uC694\uCCAD\uD558\uB294 \uC7A5\uBA74\uC744 \uACE8\uB77C\uC694.", "\uBD09\uD22C \uD558\uB098 \uC8FC\uC138\uC694.", ["\uAC00\uACA9\uD45C\uB97C \uB2E4\uC2DC \uC77D\uC5B4\uC694.", "\uC0B0 \uBE75\uACFC \uC6B0\uC720\uB97C \uB2F4\uC544\uC694.", "\uAD50\uD1B5\uCE74\uB4DC\uB97C \uCDA9\uC804\uD574\uC694."], "b", "\uBD09\uD22C\uB294 \uC0B0 \uBE75\uACFC \uC6B0\uC720\uB97C \uB2F4\uC544 \uAC00\uC838\uAC08 \uB54C \uD544\uC694\uD574\uC694.")),
        question("store-story-card", "store-payment", "store-card", "\uAE4C\uBABD\uC740 \uC5B4\uB5A4 \uBC29\uBC95\uC73C\uB85C \uACC4\uC0B0\uD588\uC5B4\uC694?", "", ["\uB2E4\uC74C \uB0A0 \uACC4\uC0B0\uD588\uC5B4\uC694.", "\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD588\uC5B4\uC694.", "\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD588\uC5B4\uC694."], "c", "\uAE4C\uBABD\uC740 \u2018\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694\u2019\uB77C\uACE0 \uB9D0\uD558\uACE0 \uCE74\uB4DC\uB97C \uC0AC\uC6A9\uD588\uC5B4\uC694.", transfer("\uC0C8 \uACC4\uC0B0 \uC7A5\uBA74\uC744 \uC77D\uACE0 \uBC29\uBC95\uC744 \uACE8\uB77C\uC694.", "\uBABD\uAE00: \u201C\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694.\u201D \uBABD\uAE00\uC774 \uC9C0\uD3D0\uB97C \uAC74\uB138\uC5B4\uC694.", ["\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD588\uC5B4\uC694.", "\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD588\uC5B4\uC694.", "\uC544\uC9C1 \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC558\uC5B4\uC694."], "a", "\uC9C0\uD3D0\uB97C \uC0AC\uC6A9\uD55C \uACB0\uC81C\uB294 \uD604\uAE08 \uACB0\uC81C\uC608\uC694."))
      ]),
      lesson("store-apply", "apply", "\uB0B4 \uAC04\uC2DD\uC744 \uC0AC\uC694", "\uB2E4\uB978 \uBB3C\uAC74\uC744 \uC0B4 \uB54C \uD544\uC694\uD55C \uB9D0\uC744 \uACE8\uB77C\uC694.", storeExpressions, [
        scene("mongle", "\uC624! \uB124 \uAC04\uC2DD\uC740 \uBB50\uC57C? \uAC19\uC774 \uACC4\uC0B0\uB300\uC5D0 \uAC00 \uBCF4\uC790!"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uBB3C\uAE4C\uC9C0 \uC900\uBE44\uD588\uC9C0. \uC900\uBE44 \uC798\uD558\uB294 \uC6A9\uC774\uAC70\uB4E0."),
        scene("marine", "\uACC4\uC0B0\uB300 \uB3C4\uCC29. \uD544\uC694\uD55C \uBD80\uD0C1\uBD80\uD130 \uD655\uC778.")
      ], [
        question("store-apply-price", "store-price-reading", "store-price", "\uAC00\uACA9\uC744 \uBB3C\uC744 \uBB38\uC7A5\uC744 \uACE8\uB77C\uC694.", "\uB3C4\uC2DC\uB77D\uC5D0 \uAC00\uACA9\uD45C\uAC00 \uC5C6\uC5B4\uC694. \uC9C1\uC6D0\uC5D0\uAC8C \uAC12\uC744 \uBB3C\uC5B4\uBCF4\uB824\uACE0 \uD574\uC694.", ["\uC774 \uB3C4\uC2DC\uB77D\uC740 \uC5BC\uB9C8\uC608\uC694?", "\uC774 \uB3C4\uC2DC\uB77D\uC740 \uC5B4\uB514\uC5D0\uC11C \uB9CC\uB4E4\uC5B4\uC694?", "\uC774 \uB3C4\uC2DC\uB77D\uC740 \uB204\uAC00 \uB9CC\uB4E4\uC5B4\uC694?"], "a", "\uAC00\uACA9\uD45C\uAC00 \uC5C6\uC744 \uB54C \u2018\uC5BC\uB9C8\uC608\uC694\u2019\uB85C \uAC12\uC744 \uBB3C\uC5B4\uC694.", transfer("\uAC00\uACA9\uC744 \uBB3C\uC744 \uBB38\uC7A5\uC744 \uACE8\uB77C\uC694.", "\uC6B0\uC0B0\uC758 \uAC12\uC744 \uC54C\uACE0 \uC2F6\uC5B4\uC694.", ["\uC6B0\uC0B0\uC740 \uB204\uAC00 \uC0C0\uC5B4\uC694?", "\uC6B0\uC0B0\uC740 \uC5BC\uB9C8\uC608\uC694?", "\uC6B0\uC0B0\uC740 \uC5B8\uC81C \uC368\uC694?"], "b", "\uC6B0\uC0B0\uC758 \uAC12\uC740 \u2018\uC5BC\uB9C8\uC608\uC694\u2019\uB85C \uBB3C\uC5B4\uC694.")),
        question("store-apply-bag", "store-bag-request", "store-bag", "\uC9C1\uC6D0\uC5D0\uAC8C \uC5B4\uB5BB\uAC8C \uB2F5\uD560\uAE4C\uC694?", "\u201C\uBD09\uD22C \uD544\uC694\uD558\uC138\uC694?\u201D \uC0B0 \uBB3C\uAC74\uC774 \uB9CE\uC544\uC11C \uB2F4\uC744 \uBD09\uD22C\uAC00 \uD544\uC694\uD574\uC694.", ["\uC544\uB2C8\uC694, \uAD1C\uCC2E\uC544\uC694.", "\uAC00\uACA9\uC740 \uC5BC\uB9C8\uC608\uC694?", "\uB124, \uBD09\uD22C \uD558\uB098 \uC8FC\uC138\uC694."], "c", "\uBD09\uD22C\uAC00 \uD544\uC694\uD558\uBBC0\uB85C \u2018\uB124\u2019\uB77C\uACE0 \uB2F5\uD558\uACE0 \uD558\uB098\uB97C \uBD80\uD0C1\uD574\uC694.", transfer("\uC9C1\uC6D0\uC5D0\uAC8C \uC5B4\uB5BB\uAC8C \uB2F5\uD560\uAE4C\uC694?", "\u201C\uBD09\uD22C \uB4DC\uB9B4\uAE4C\uC694?\u201D \uB0B4 \uAC00\uBC29\uC5D0 \uBB3C\uAC74\uC744 \uB2F4\uC744 \uAC70\uC608\uC694. \uBD09\uD22C\uB294 \uD544\uC694 \uC5C6\uC5B4\uC694.", ["\uB124, \uBD09\uD22C \uB450 \uAC1C \uC8FC\uC138\uC694.", "\uC544\uB2C8\uC694, \uAD1C\uCC2E\uC544\uC694.", "\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694."], "b", "\uBD09\uD22C\uAC00 \uD544\uC694 \uC5C6\uC73C\uBBC0\uB85C \uC815\uC911\uD558\uAC8C \u2018\uC544\uB2C8\uC694, \uAD1C\uCC2E\uC544\uC694\u2019\uB77C\uACE0 \uB2F5\uD574\uC694.")),
        question("store-apply-card", "store-payment", "store-card", "\uCE74\uB4DC\uB85C \uAC12\uC744 \uB0B4\uB824\uACE0 \uD574\uC694. \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "", ["\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694.", "\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694.", "\uB098\uC911\uC5D0 \uACC4\uC0B0\uD560\uAC8C\uC694."], "b", "\uCE74\uB4DC\uB97C \uC0AC\uC6A9\uD560 \uB54C\uB294 \u2018\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694\u2019\uB77C\uACE0 \uD574\uC694.", transfer("\uD604\uAE08\uC73C\uB85C \uAC12\uC744 \uB0B4\uB824\uACE0 \uD574\uC694. \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "", ["\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694.", "\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694.", "\uAC00\uACA9\uD45C\uB97C \uBD99\uC5EC \uC8FC\uC138\uC694."], "a", "\uD604\uAE08\uC744 \uC0AC\uC6A9\uD558\uBBC0\uB85C \u2018\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694\u2019\uAC00 \uC0C1\uD669\uC5D0 \uB9DE\uC544\uC694."))
      ])
    ]
  },
  {
    id: "directions",
    title: "\uAC70\uAFB8\uB85C \uB4E0 \uC9C0\uB3C4",
    subtitle: "\uC704\uCE58\uB97C \uBB3B\uACE0 \uAE38\uC744 \uCC3E\uC544\uC694",
    icon: "map",
    level: "\uAE30\uCD08 \uC0DD\uD65C \uD55C\uAD6D\uC5B4",
    skills: [skill("directions-location-question", "\uC7A5\uC18C\uC758 \uC704\uCE58 \uBB3B\uAE30"), skill("directions-turn", "\uC774\uB3D9 \uBC29\uD5A5 \uC774\uD574\uD558\uAE30"), skill("directions-landmark", "\uC8FC\uBCC0 \uC7A5\uC18C\uB85C \uC704\uCE58 \uCC3E\uAE30")],
    lessons: [
      lesson("directions-expressions", "expressions", "\uC5B4\uB514\uB85C \uAC00\uBA74 \uB420\uAE4C\uC694?", "\uC704\uCE58 \uC9C8\uBB38\xB7\uC774\uB3D9 \uBC29\uD5A5\xB7\uC8FC\uBCC0 \uC7A5\uC18C\uB97C \uC77D\uC5B4\uC694.", directionExpressions, [
        scene("mongle", "\uC6B0\uC640! \uC9C0\uB3C4\uC5D0\uB3C4 \uC791\uC740 \uB098\uBB34\uAC00 \uC788\uB124! \uAC19\uC774 \uACF5\uC6D0 \uCC3E\uC744\uAE4C?"),
        scene("kkamong", "\uAE38\uC740 \uC774 \uBAB8\uC774 \uC548\uB0B4\uD558\uC9C0. \uB0B4 \uC9C0\uB3C4\uB9CC \uC81C\uB300\uB85C \uD3B4\uBA74 \uB418\uB294 \uAC70\uC57C."),
        scene("marine", "\uACBD\uB85C \uD655\uC778. \uBAA9\uC801\uC9C0\uC640 \uBC29\uD5A5\uC744 \uB530\uB85C \uC77D\uC5B4\uB77C.")
      ], [
        question("directions-expressions-where", "directions-location-question", "directions-where", "\uACF5\uC6D0\uC758 \uC704\uCE58\uB97C \uC54C\uACE0 \uC2F6\uC5B4\uC694. \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "", ["\uACF5\uC6D0\uC740 \uBA87 \uC2DC\uC5D0 \uC5F4\uC5B4\uC694?", "\uACF5\uC6D0\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uACF5\uC6D0\uC5D0\uB294 \uB098\uBB34\uAC00 \uB9CE\uC544\uC694?"], "b", "\uC7A5\uC18C\uC758 \uC704\uCE58\uB294 \u2018\uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694\u2019\uB85C \uBB3C\uC5B4\uC694.", transfer("\uD654\uC7A5\uC2E4\uC758 \uC704\uCE58\uB97C \uBB3B\uB294 \uB9D0\uC744 \uACE8\uB77C\uC694.", "", ["\uD654\uC7A5\uC2E4\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uD654\uC7A5\uC2E4\uC740 \uCCAD\uC18C \uC911\uC774\uC5D0\uC694?", "\uD654\uC7A5\uC2E4\uC740 \uAE68\uB057\uD574\uC694?"], "a", "\u2018\uC5B4\uB514\uC5D0\u2019\uB294 \uC7A5\uC18C\uC758 \uC704\uCE58\uB97C \uBB3B\uB294 \uD45C\uD604\uC774\uC5D0\uC694.")),
        question("directions-expressions-right", "directions-turn", "directions-right", "\u2018\uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC138\uC694\u2019\uB77C\uB294 \uC548\uB0B4\uC5D0 \uB9DE\uB294 \uBC29\uD5A5\uC740 \uBB34\uC5C7\uC774\uC5D0\uC694?", "\uAE38\uC744 \uB530\uB77C \uAC77\uB2E4\uAC00 \uAC08\uB9BC\uAE38\uC5D0 \uB3C4\uCC29\uD588\uC5B4\uC694.", ["\uC67C\uCABD", "\uB4A4\uCABD", "\uC624\uB978\uCABD"], "c", "\u2018\uC624\uB978\uCABD\uC73C\uB85C\u2019\uB294 \uC624\uB978\uCABD \uBC29\uD5A5\uC73C\uB85C \uC6C0\uC9C1\uC774\uB77C\uB294 \uB73B\uC774\uC5D0\uC694.", transfer("\uAC08\uB9BC\uAE38\uC5D0\uC11C \u2018\uC67C\uCABD\uC73C\uB85C \uAC00\uC138\uC694\u2019\uB77C\uB294 \uC548\uB0B4\uB97C \uC77D\uC5C8\uC5B4\uC694.", "\uC5B4\uB290 \uBC29\uD5A5\uC73C\uB85C \uAC00\uC57C \uD574\uC694?", ["\uC624\uB978\uCABD", "\uC67C\uCABD", "\uB4A4\uCABD"], "b", "\uC0C8 \uC548\uB0B4\uC758 \uBC29\uD5A5\uC740 \uC67C\uCABD\uC774\uC5D0\uC694. \uC774\uC804 \uBB38\uC81C\uC758 \uBC29\uD5A5\uC744 \uADF8\uB300\uB85C \uACE0\uB974\uC9C0 \uC54A\uC544\uC694.")),
        question("directions-expressions-beside", "directions-landmark", "directions-beside", "\uACF5\uC6D0\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\u201C\uACF5\uC6D0\uC740 \uC740\uD589 \uC606\uC5D0 \uC788\uC5B4\uC694.\u201D", ["\uC740\uD589 \uC606", "\uC740\uD589 \uC548", "\uD559\uAD50 \uB4A4"], "a", "\u2018\uC740\uD589 \uC606\u2019\uC740 \uC740\uD589 \uAC00\uAE4C\uC774 \uB098\uB780\uD788 \uC788\uB294 \uC704\uCE58\uC608\uC694.", transfer("\uB3C4\uC11C\uAD00\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\u201C\uB3C4\uC11C\uAD00\uC740 \uD559\uAD50 \uC606\uC5D0 \uC788\uC5B4\uC694.\u201D", ["\uD559\uAD50 \uC548", "\uC740\uD589 \uC55E", "\uD559\uAD50 \uC606"], "c", "\uAE30\uC900 \uC7A5\uC18C\uAC00 \uD559\uAD50\uC774\uACE0 \uC704\uCE58\uB294 \uADF8 \uC606\uC774\uC5D0\uC694."))
      ]),
      lesson("directions-story", "story", "\uC9C0\uB3C4\uB97C \uB4A4\uC9D1\uC73C\uBA74", "\uC138 \uCE5C\uAD6C\uAC00 \uACF5\uC6D0\uAE4C\uC9C0 \uAC00\uB294 \uAE38\uC744 \uC774\uD574\uD574\uC694.", directionExpressions, [
        scene("narrator", "\uACF5\uC6D0\uC5D0\uC11C \uAF43\uC744 \uBCF4\uB824\uACE0 \uC138 \uCE5C\uAD6C\uAC00 \uAE38\uC744 \uB098\uC130\uC5B4\uC694. \uAE4C\uBABD\uC774 \uC9C0\uB3C4\uB97C \uD3BC\uCCD0\uC694."),
        scene("mongle", "\uC5B4? \uC9C0\uB3C4 \uAE00\uC790\uAC00 \uAC70\uAFB8\uB85C\uB124! \uAC19\uC774 \uB3CC\uB824 \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uBC18\uB300\uCABD\uC5D0\uC11C\uB3C4 \uC77D\u2026 \uC544\uB2C8, \uBC14\uB78C \uB54C\uBB38\uC5D0 \uB3CC\uC544\uAC04 \uAC70\uC57C."),
        scene("narrator", "\uC785\uAD6C\uC758 \uC548\uB0B4\uD310\uC5D0\uB294 \u2018\uACF5\uC6D0: \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC624\uB978\uCABD. \uC740\uD589 \uC606.\u2019\uC774\uB77C\uACE0 \uC801\uD600 \uC788\uC5B4\uC694."),
        scene("marine", "\uC9C0\uB3C4 \uBC29\uD5A5 \uC218\uC815. \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC624\uB978\uCABD. \uC740\uD589 \uC606. \uD655\uC778."),
        scene("mongle", "\uC6B0\uC640! \uC740\uD589 \uC606\uC5D0 \uAF43\uC774 \uBCF4\uC5EC! \uAC19\uC774 \uC800\uAE30\uB85C \uAC00\uC790!"),
        scene("kkamong", "\uB0B4\uAC00 \uCC98\uC74C\uBD80\uD130 \uAF43 \uCABD\uC73C\uB85C \uAC00\uB824\uACE0 \uD588\uC9C0. \u2026\uB9C8\uB9B0\uB3C4 \uBCF4\uACE0 \uC788\uC5C8\uAD70."),
        scene("narrator", "\uCE5C\uAD6C\uB4E4\uC740 \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC11C \uC740\uD589 \uC606\uC758 \uACF5\uC6D0\uC5D0 \uB3C4\uCC29\uD574\uC694."),
        scene("marine", "\uB3C4\uCC29 \uD655\uC778. \uAF43, \uC5EC\uC12F \uC1A1\uC774. \u2026\uD55C \uC1A1\uC774\uB294 \uC544\uC9C1 \uD53C\uB294 \uC911\uC774\uB2E4.")
      ], [
        question("directions-story-where", "directions-location-question", "directions-where", "\uC138 \uCE5C\uAD6C\uAC00 \uCC3E\uB358 \uC7A5\uC18C\uC758 \uC704\uCE58\uB97C \uBB3B\uB294 \uB9D0\uC740 \uBB34\uC5C7\uC774\uC5D0\uC694?", "", ["\uACF5\uC6D0\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uD559\uAD50\uAC00 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uCE74\uD398\uAC00 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?"], "a", "\uC138 \uCE5C\uAD6C\uC758 \uBAA9\uC801\uC9C0\uB294 \uAF43\uC744 \uBCFC \uACF5\uC6D0\uC774\uBBC0\uB85C \uACF5\uC6D0\uC758 \uC704\uCE58\uB97C \uBB3C\uC5B4\uC694.", transfer("\uC0C8 \uBAA9\uC801\uC9C0\uC758 \uC704\uCE58\uB97C \uBB3B\uB294 \uB9D0\uC744 \uACE8\uB77C\uC694.", "\uC138 \uCE5C\uAD6C\uAC00 \uCC45\uC744 \uBE4C\uB9AC\uB824\uACE0 \uB3C4\uC11C\uAD00\uC744 \uCC3E\uACE0 \uC788\uC5B4\uC694.", ["\uC740\uD589\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uB3C4\uC11C\uAD00\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uACF5\uC6D0\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?"], "b", "\uCC45\uC744 \uBE4C\uB9B4 \uBAA9\uC801\uC9C0\uB294 \uB3C4\uC11C\uAD00\uC774\uC5D0\uC694. \uD574\uB2F9 \uC7A5\uC18C\uC758 \uC704\uCE58\uB97C \uBB3C\uC5B4\uC694.")),
        question("directions-story-turn", "directions-turn", "directions-right", "\uC138 \uCE5C\uAD6C\uB294 \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC5B4\uB290 \uCABD\uC73C\uB85C \uAC14\uC5B4\uC694?", "", ["\uC67C\uCABD", "\uC624\uB978\uCABD", "\uC654\uB358 \uAE38"], "b", "\uC548\uB0B4\uD310\uC5D0 \uC801\uD78C \uB300\uB85C \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC624\uB978\uCABD\uC73C\uB85C \uAC14\uC5B4\uC694.", transfer("\uC0C8 \uC548\uB0B4\uB97C \uC77D\uACE0 \uAC08 \uBC29\uD5A5\uC744 \uACE8\uB77C\uC694.", "\u201C\uB3C4\uC11C\uAD00\uC5D0 \uAC00\uB824\uBA74 \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC67C\uCABD\uC73C\uB85C \uAC00\uC138\uC694.\u201D", ["\uC624\uB978\uCABD", "\uC654\uB358 \uAE38", "\uC67C\uCABD"], "c", "\uC0C8 \uC548\uB0B4\uC758 \uAC08\uB9BC\uAE38 \uBC29\uD5A5\uC740 \uC67C\uCABD\uC774\uC5D0\uC694.")),
        question("directions-story-landmark", "directions-landmark", "directions-beside", "\uC774\uC57C\uAE30 \uC18D \uACF5\uC6D0\uC740 \uC5B4\uB290 \uAC74\uBB3C \uC606\uC5D0 \uC788\uC5B4\uC694?", "", ["\uD559\uAD50", "\uB3C4\uC11C\uAD00", "\uC740\uD589"], "c", "\uC548\uB0B4\uD310\uACFC \uB3C4\uCC29 \uC7A5\uBA74 \uBAA8\uB450 \uACF5\uC6D0\uC774 \uC740\uD589 \uC606\uC5D0 \uC788\uB2E4\uACE0 \uC54C\uB824 \uC918\uC694.", transfer("\uC0C8 \uC548\uB0B4\uB97C \uC77D\uACE0 \uAE30\uC900 \uAC74\uBB3C\uC744 \uACE8\uB77C\uC694.", "\u201C\uC57D\uAD6D\uC740 \uBCD1\uC6D0 \uC606\uC5D0 \uC788\uC5B4\uC694.\u201D", ["\uBCD1\uC6D0", "\uC740\uD589", "\uD559\uAD50"], "a", "\uC57D\uAD6D\uC758 \uC704\uCE58\uB97C \uC54C\uB824 \uC8FC\uB294 \uAE30\uC900 \uAC74\uBB3C\uC740 \uBCD1\uC6D0\uC774\uC5D0\uC694."))
      ]),
      lesson("directions-apply", "apply", "\uB0B4\uAC00 \uAE38\uC744 \uBB3C\uC5B4\uC694", "\uC0C8 \uC7A5\uC18C\uC758 \uC704\uCE58\uC640 \uBC29\uD5A5\uC744 \uC77D\uACE0 \uACE8\uB77C\uC694.", directionExpressions, [
        scene("mongle", "\uC624! \uC774\uBC88\uC5D0\uB294 \uB2E4\uB978 \uACF3\uC774\uB124! \uAC19\uC774 \uAE38 \uCC3E\uC544\uBCFC\uAE4C?"),
        scene("kkamong", "\uB0B4 \uC9C0\uB3C4\uB294 \uC774\uC81C \uB611\uBC14\uB85C\uC57C. \uC774 \uBAB8\uC758 \uC548\uB0B4\uB3C4 \uB611\uBC14\uB974\uC9C0."),
        scene("marine", "\uC774\uB3D9 \uC900\uBE44. \uBAA9\uC801\uC9C0, \uBC29\uD5A5, \uAE30\uC900 \uC7A5\uC18C \uD655\uC778.")
      ], [
        question("directions-apply-where", "directions-location-question", "directions-where", "\uC9C1\uC6D0\uC5D0\uAC8C \uBB34\uC5C7\uC744 \uBB3C\uC744\uAE4C\uC694?", "\uCC98\uC74C \uC628 \uB3D9\uB124\uC5D0\uC11C \uC57D\uAD6D\uC744 \uCC3E\uACE0 \uC788\uC5B4\uC694.", ["\uC57D\uAD6D\uC740 \uBA87 \uC2DC\uC5D0 \uB2EB\uC544\uC694?", "\uC57D\uAD6D\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uC57D\uAD6D\uC5D0\uC11C \uC57D\uC744 \uC0C0\uC5B4\uC694?"], "b", "\uCC3E\uB294 \uC57D\uAD6D\uC758 \uC704\uCE58\uB97C \u2018\uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694\u2019\uB85C \uBB3C\uC5B4\uC694.", transfer("\uC9C0\uD558\uCCA0\uC5ED\uC744 \uCC3E\uACE0 \uC788\uC5B4\uC694. \uBB34\uC5C7\uC744 \uBB3C\uC744\uAE4C\uC694?", "\uCC98\uC74C \uC628 \uAC70\uB9AC\uB77C \uC704\uCE58\uB97C \uBAB0\uB77C\uC694.", ["\uC9C0\uD558\uCCA0\uC740 \uBA87 \uC2DC\uC5D0 \uC640\uC694?", "\uC9C0\uD558\uCCA0 \uD45C\uB294 \uC5BC\uB9C8\uC608\uC694?", "\uC9C0\uD558\uCCA0\uC5ED\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?"], "c", "\uAC00\uB824\uB294 \uC7A5\uC18C\uAC00 \uC9C0\uD558\uCCA0\uC5ED\uC73C\uB85C \uBC14\uB00C\uC5B4\uB3C4 \uC704\uCE58 \uC9C8\uBB38\uC740 \u2018\uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694\u2019\uC608\uC694.")),
        question("directions-apply-turn", "directions-turn", "directions-right", "\uC548\uB0B4\uC5D0 \uB530\uB77C \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC5B4\uB290 \uCABD\uC73C\uB85C \uAC08\uAE4C\uC694?", "\u201C\uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC138\uC694. \uD3B8\uC758\uC810\uC774 \uBCF4\uC774\uBA74 \uBA48\uCD94\uC138\uC694.\u201D", ["\uC624\uB978\uCABD", "\uC67C\uCABD", "\uB4A4\uCABD"], "a", "\uBA3C\uC800 \uAC08 \uBC29\uD5A5\uC740 \uC624\uB978\uCABD\uC774\uACE0 \uD3B8\uC758\uC810\uC740 \uBA48\uCD9C \uAE30\uC900\uC774\uC5D0\uC694.", transfer("\uC548\uB0B4\uC5D0 \uB530\uB77C \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC5B4\uB290 \uCABD\uC73C\uB85C \uAC08\uAE4C\uC694?", "\u201C\uC67C\uCABD\uC73C\uB85C \uAC00\uC138\uC694. \uC6B0\uCCB4\uAD6D \uC55E\uC5D0\uC11C \uAE30\uB2E4\uB9AC\uC138\uC694.\u201D", ["\uB4A4\uCABD", "\uC67C\uCABD", "\uC624\uB978\uCABD"], "b", "\uAC08 \uBC29\uD5A5\uC740 \uC67C\uCABD\uC774\uC5D0\uC694. \uAE30\uB2E4\uB9B4 \uC7A5\uC18C\uC640 \uC774\uB3D9 \uBC29\uD5A5\uC744 \uB098\uB204\uC5B4 \uC77D\uC5B4\uC694.")),
        question("directions-apply-landmark", "directions-landmark", "directions-beside", "\uC57D\uAD6D\uC758 \uC704\uCE58\uC5D0 \uB9DE\uB294 \uC124\uBA85\uC744 \uACE8\uB77C\uC694.", "\u201C\uC57D\uAD6D\uC740 \uBCD1\uC6D0 \uC606\uC5D0 \uC788\uC5B4\uC694.\u201D", ["\uBCD1\uC6D0 \uC548\uC5D0 \uC788\uC5B4\uC694.", "\uD559\uAD50 \uB4A4\uC5D0 \uC788\uC5B4\uC694.", "\uBCD1\uC6D0 \uC606\uC5D0 \uC788\uC5B4\uC694."], "c", "\u2018\uC606\u2019\uACFC \u2018\uC548\u2019\uC740 \uB2E4\uB978 \uC704\uCE58\uC608\uC694. \uBCD1\uC6D0 \uC606\uC774 \uB9DE\uC544\uC694.", transfer("\uC6B0\uCCB4\uAD6D\uC758 \uC704\uCE58\uC5D0 \uB9DE\uB294 \uC124\uBA85\uC744 \uACE8\uB77C\uC694.", "\u201C\uC6B0\uCCB4\uAD6D\uC740 \uD559\uAD50 \uC606\uC5D0 \uC788\uC5B4\uC694.\u201D", ["\uD559\uAD50 \uC606\uC5D0 \uC788\uC5B4\uC694.", "\uD559\uAD50 \uC548\uC5D0 \uC788\uC5B4\uC694.", "\uC740\uD589 \uB4A4\uC5D0 \uC788\uC5B4\uC694."], "a", "\uC0C8 \uAE30\uC900 \uC7A5\uC18C\uB294 \uD559\uAD50\uC774\uACE0 \uC6B0\uCCB4\uAD6D\uC740 \uD559\uAD50 \uC606\uC5D0 \uC788\uC5B4\uC694."))
      ])
    ]
  },
  {
    id: "transit",
    title: "\uBC84\uC2A4\uB85C \uAF43\uAE38\uAE4C\uC9C0",
    subtitle: "\uBAA9\uC801\uC9C0\uC640 \uB0B4\uB9B4 \uACF3\uC744 \uD655\uC778\uD574\uC694",
    icon: "transit",
    level: "\uAE30\uCD08 \uC0DD\uD65C \uD55C\uAD6D\uC5B4",
    skills: [skill("transit-route", "\uBAA9\uC801\uC9C0 \uD655\uC778\uD558\uAE30"), skill("transit-alighting", "\uB0B4\uB9B4 \uC21C\uC11C \uC774\uD574\uD558\uAE30"), skill("transit-instruction", "\uC2B9\uCC28 \uC548\uB0B4 \uC774\uD574\uD558\uAE30")],
    lessons: [
      lesson("transit-expressions", "expressions", "\uBC84\uC2A4 \uD0C0\uAE30 \uC804\uD6C4", "\uBAA9\uC801\uC9C0\xB7\uB0B4\uB9B4 \uB54C\xB7\uAD50\uD1B5\uCE74\uB4DC \uC548\uB0B4\uB97C \uC77D\uC5B4\uC694.", transitExpressions, [
        scene("mongle", "\uC6B0\uC640! \uBC84\uC2A4 \uCC3D\uBB38\uC774 \uCEE4! \uAC19\uC774 \uACF5\uC6D0\uC5D0 \uAC00 \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uBC84\uC2A4\uB3C4 \uC798 \uD0C0\uC9C0. \uB0B4\uB9B4 \uACF3\uB9CC \uBA3C\uC800 \uBCF4\uBA74 \uB418\uB294 \uAC70\uC57C."),
        scene("marine", "\uD0D1\uC2B9 \uC900\uBE44. \uBAA9\uC801\uC9C0, \uCE74\uB4DC, \uC815\uB958\uC7A5 \uD655\uC778.")
      ], [
        question("transit-expressions-route", "transit-route", "transit-destination", "\uBC84\uC2A4\uAC00 \uACF5\uC6D0\uC73C\uB85C \uAC00\uB294\uC9C0 \uD655\uC778\uD558\uB294 \uB9D0\uC744 \uACE8\uB77C\uC694.", "", ["\uACF5\uC6D0\uC740 \uBA87 \uC2DC\uC5D0 \uB2EB\uC544\uC694?", "\uC774 \uBC84\uC2A4\uB294 \uACF5\uC6D0\uC5D0 \uAC00\uC694?", "\uACF5\uC6D0\uC5D0 \uAF43\uC774 \uB9CE\uC544\uC694?"], "b", "\uBC84\uC2A4\uC758 \uBAA9\uC801\uC9C0\uB97C \uD655\uC778\uD558\uB824\uBA74 \uADF8 \uBC84\uC2A4\uAC00 \uACF5\uC6D0\uC5D0 \uAC00\uB294\uC9C0 \uBB3C\uC5B4\uC694.", transfer("\uBC84\uC2A4\uAC00 \uB3C4\uC11C\uAD00\uC73C\uB85C \uAC00\uB294\uC9C0 \uD655\uC778\uD574\uC694.", "", ["\uC774 \uBC84\uC2A4\uB294 \uB3C4\uC11C\uAD00\uC5D0 \uAC00\uC694?", "\uB3C4\uC11C\uAD00\uC5D0 \uCC45\uC774 \uB9CE\uC544\uC694?", "\uB3C4\uC11C\uAD00\uC740 \uBA87 \uC2DC\uC5D0 \uC5F4\uC5B4\uC694?"], "a", "\uAC00\uB824\uB294 \uC7A5\uC18C\uB97C \uB3C4\uC11C\uAD00\uC73C\uB85C \uBC14\uAFD4 \uAC19\uC740 \uBC29\uC2DD\uC73C\uB85C \uBAA9\uC801\uC9C0\uB97C \uD655\uC778\uD574\uC694.")),
        question("transit-expressions-alight", "transit-alighting", "transit-alight", "\u2018\uB2E4\uC74C \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694\u2019\uC5D0 \uB9DE\uB294 \uD589\uB3D9\uC740 \uBB34\uC5C7\uC774\uC5D0\uC694?", "\uBC84\uC2A4\uAC00 \uC9C0\uAE08 \uC815\uB958\uC7A5\uC5D0 \uBA48\uCDC4\uC5B4\uC694.", ["\uC9C0\uAE08 \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694.", "\uC544\uC9C1 \uBC84\uC2A4\uB97C \uD0C0\uC9C0 \uC54A\uC544\uC694.", "\uD55C \uC815\uB958\uC7A5 \uB354 \uAC00\uC11C \uB0B4\uB824\uC694."], "c", "\u2018\uB2E4\uC74C\u2019\uC740 \uC9C0\uAE08 \uB4A4\uC5D0 \uC624\uB294 \uC815\uB958\uC7A5\uC774\uC5D0\uC694. \uD55C \uC815\uB958\uC7A5 \uB354 \uAC00\uC694.", transfer("\u2018\uC774\uBC88 \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694\u2019\uC5D0 \uB9DE\uB294 \uD589\uB3D9\uC740 \uBB34\uC5C7\uC774\uC5D0\uC694?", "\uBC84\uC2A4\uAC00 \uC774\uBC88 \uC815\uB958\uC7A5\uC5D0 \uBA48\uCDC4\uC5B4\uC694.", ["\uD55C \uC815\uB958\uC7A5 \uB354 \uAC00\uC694.", "\uC9C0\uAE08 \uB0B4\uB824\uC694.", "\uBC84\uC2A4\uB97C \uB2E4\uC2DC \uD0C0\uC694."], "b", "\u2018\uC774\uBC88\u2019\uACFC \u2018\uB2E4\uC74C\u2019\uC740 \uB2EC\uB77C\uC694. \uC774\uBC88 \uC815\uB958\uC7A5\uC740 \uC9C0\uAE08 \uBA48\uCD98 \uACF3\uC774\uC5D0\uC694.")),
        question("transit-expressions-card", "transit-instruction", "transit-card", "\u2018\uAD50\uD1B5\uCE74\uB4DC\uB97C \uCC0D\uC73C\uC138\uC694\u2019\uC5D0 \uB9DE\uB294 \uD589\uB3D9\uC740 \uBB34\uC5C7\uC774\uC5D0\uC694?", "\uBC84\uC2A4\uC5D0 \uC62C\uB77C \uCE74\uB4DC \uB2E8\uB9D0\uAE30\uB97C \uBD24\uC5B4\uC694.", ["\uAD50\uD1B5\uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uC694.", "\uAD50\uD1B5\uCE74\uB4DC \uC0AC\uC9C4\uC744 \uCC0D\uC5B4\uC694.", "\uAD50\uD1B5\uCE74\uB4DC\uB97C \uC758\uC790\uC5D0 \uB194\uC694."], "a", "\uBC84\uC2A4\uC5D0\uC11C \u2018\uCE74\uB4DC\uB97C \uCC0D\uB2E4\u2019\uB294 \uB2E8\uB9D0\uAE30\uC5D0 \uCE74\uB4DC\uB97C \uB300\uB294 \uB73B\uC774\uC5D0\uC694.", transfer("\u2018\uB0B4\uB9B4 \uB54C\uB3C4 \uAD50\uD1B5\uCE74\uB4DC\uB97C \uCC0D\uC73C\uC138\uC694\u2019\uC5D0 \uB9DE\uB294 \uD589\uB3D9\uC744 \uACE8\uB77C\uC694.", "\uC774 \uBC84\uC2A4\uC5D0\uB294 \uB0B4\uB9B4 \uB54C \uCE74\uB4DC\uB97C \uCC0D\uC73C\uB77C\uB294 \uC548\uB0B4\uAC00 \uC788\uC5B4\uC694.", ["\uCE74\uB4DC\uB97C \uC9D1\uC5D0 \uB450\uACE0 \uB0B4\uB824\uC694.", "\uCE74\uB4DC \uC0AC\uC9C4\uC744 \uCC0D\uC5B4\uC694.", "\uB0B4\uB9AC\uAE30 \uC804\uC5D0 \uB2E8\uB9D0\uAE30\uC5D0 \uCE74\uB4DC\uB97C \uB300\uC694."], "c", "\uC774 \uBB38\uC81C\uC758 \uC548\uB0B4\uB294 \uB0B4\uB9B4 \uB54C \uB2E8\uB9D0\uAE30\uC5D0 \uCE74\uB4DC\uB97C \uB300\uB77C\uB294 \uB73B\uC774\uC5D0\uC694."))
      ]),
      lesson("transit-story", "story", "\uB0B4\uB9B4 \uACF3\uC740 \uB2E4\uC74C\uC774\uC57C", "\uC774\uC57C\uAE30 \uC18D \uBC84\uC2A4 \uB178\uC120\uACFC \uB0B4\uB9B4 \uC21C\uC11C\uB97C \uC774\uD574\uD574\uC694.", transitExpressions, [
        scene("narrator", "\uC774\uC57C\uAE30 \uC18D \uB9C8\uB8E8 \uBC84\uC2A4 \uB178\uC120\uC774\uC5D0\uC694. \uB3C4\uC11C\uAD00 \uB2E4\uC74C \uC815\uB958\uC7A5\uC740 \uAF43\uAE38 \uACF5\uC6D0\uC774\uC5D0\uC694."),
        scene("mongle", "\uC6B0\uC640! \uACF5\uC6D0\uAE4C\uC9C0 \uAC19\uC774 \uBC84\uC2A4 \uD0C0\uACE0 \uAC08\uAE4C? \uCC3D\uBC16 \uAF43\uB3C4 \uBCF4\uC790!"),
        scene("kkamong", "\uBC84\uC2A4 \uACE0\uB974\uAE30\uB294 \uC774 \uBAB8\uC758 \uD2B9\uAE30\uC9C0. \u2018\uC774 \uBC84\uC2A4\uB294 \uACF5\uC6D0\uC5D0 \uAC00\uC694?\u2019"),
        scene("narrator", "\uC548\uB0B4\uD45C\uC5D0 \u2018\uAF43\uAE38 \uACF5\uC6D0\uD589\u2019\uC774\uB77C\uACE0 \uC801\uD600 \uC788\uC5B4\uC694. \uC138 \uCE5C\uAD6C\uB294 \uAD50\uD1B5\uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uACE0 \uD0C0\uC694."),
        scene("marine", "\uD0D1\uC2B9 \uD655\uC778. \uC804\uC6D0, \uC14B. \uAD50\uD1B5\uCE74\uB4DC \uC0AC\uC6A9 \uC644\uB8CC."),
        scene("narrator", "\uBC84\uC2A4\uAC00 \uB3C4\uC11C\uAD00\uC5D0 \uBA48\uCDB0\uC694. \uC548\uB0B4\uBB38\uC5D0\uB294 \u2018\uB2E4\uC74C \uC815\uB958\uC7A5: \uAF43\uAE38 \uACF5\uC6D0\u2019\uC774\uB77C\uACE0 \uB098\uC640\uC694."),
        scene("kkamong", "\uB0B4\uAC00 \uBC8C\uC368 \uC77C\uC5B4\uC120 \uAC74 \uB2E4\uB9AC\uB97C \uD3B4\uB824\uACE0\uC9C0. \uC544\uC9C1 \uB0B4\uB9B4 \uB54C\uB294 \uC544\uB2C8\uC57C."),
        scene("mongle", "\uC5B4? \uB2E4\uC74C\uC774 \uACF5\uC6D0\uC774\uB124! \uAC19\uC774 \uD55C \uC815\uB958\uC7A5 \uB354 \uAC00\uC790!"),
        scene("marine", "\uD558\uCC28 \uC21C\uC11C \uD655\uC778. \uB3C4\uC11C\uAD00 \uB2E4\uC74C, \uAF43\uAE38 \uACF5\uC6D0."),
        scene("narrator", "\uB2E4\uC74C \uC815\uB958\uC7A5\uC5D0 \uB3C4\uCC29\uD558\uC790 \uCE5C\uAD6C\uB4E4\uC774 \uB0B4\uB824\uC694. \uB9C8\uB9B0\uC774 \uC791\uC740 \uAF43\uC744 \uBCF4\uACE0 \uC7A0\uAE50 \uBA48\uCDB0\uC694."),
        scene("marine", "\uB3C4\uCC29 \uC644\uB8CC. \uC791\uC740 \uAF43, \uD558\uB098. \u2026\uC774\uB3D9\uC740 \uC7A0\uC2DC \uBA48\uCD98\uB2E4.")
      ], [
        question("transit-story-route", "transit-route", "transit-destination", "\uC138 \uCE5C\uAD6C\uAC00 \uD0C4 \uBC84\uC2A4\uC758 \uBAA9\uC801\uC9C0\uB294 \uC5B4\uB514\uC608\uC694?", "", ["\uD559\uAD50", "\uD3B8\uC758\uC810", "\uAF43\uAE38 \uACF5\uC6D0"], "c", "\uC548\uB0B4\uD45C\uC5D0\uB294 \u2018\uAF43\uAE38 \uACF5\uC6D0\uD589\u2019\uC774\uB77C\uACE0 \uC801\uD600 \uC788\uC5B4\uC694.", transfer("\uC0C8 \uBC84\uC2A4 \uC548\uB0B4\uD45C\uB97C \uC77D\uACE0 \uBAA9\uC801\uC9C0\uB97C \uACE8\uB77C\uC694.", "\uC548\uB0B4\uD45C: \u201C\uB9C8\uB8E8 \uB3C4\uC11C\uAD00\uD589\u201D", ["\uAF43\uAE38 \uACF5\uC6D0", "\uB9C8\uB8E8 \uB3C4\uC11C\uAD00", "\uB9C8\uB8E8 \uCE74\uD398"], "b", "\u2018\uB3C4\uC11C\uAD00\uD589\u2019\uC740 \uB3C4\uC11C\uAD00 \uCABD\uC73C\uB85C \uAC00\uB294 \uBC84\uC2A4\uB77C\uB294 \uB73B\uC774\uC5D0\uC694.")),
        question("transit-story-alight", "transit-alighting", "transit-alight", "\uB3C4\uC11C\uAD00\uC5D0 \uBA48\uCDC4\uC744 \uB54C \uC138 \uCE5C\uAD6C\uB294 \uC5B4\uB5BB\uAC8C \uD588\uC5B4\uC694?", "", ["\uD55C \uC815\uB958\uC7A5 \uB354 \uAC14\uC5B4\uC694.", "\uBC14\uB85C \uB0B4\uB838\uC5B4\uC694.", "\uCC98\uC74C \uC815\uB958\uC7A5\uC73C\uB85C \uB3CC\uC544\uAC14\uC5B4\uC694."], "a", "\uAF43\uAE38 \uACF5\uC6D0\uC774 \uB2E4\uC74C \uC815\uB958\uC7A5\uC774\uBBC0\uB85C \uD55C \uC815\uB958\uC7A5 \uB354 \uAC14\uC5B4\uC694.", transfer("\uC0C8 \uB178\uC120\uC5D0\uC11C \uC5B8\uC81C \uB0B4\uB9B4\uAE4C\uC694?", "\uD604\uC7AC \uC815\uB958\uC7A5: \uD559\uAD50 / \uB2E4\uC74C \uC815\uB958\uC7A5: \uB9C8\uB8E8 \uB3C4\uC11C\uAD00. \uBAA9\uC801\uC9C0\uB294 \uB9C8\uB8E8 \uB3C4\uC11C\uAD00\uC774\uC5D0\uC694.", ["\uD559\uAD50\uC5D0\uC11C \uB0B4\uB824\uC694.", "\uBC84\uC2A4\uB97C \uD0C0\uC9C0 \uC54A\uC544\uC694.", "\uB2E4\uC74C \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694."], "c", "\uBAA9\uC801\uC9C0\uAC00 \uB2E4\uC74C \uC815\uB958\uC7A5\uC774\uBBC0\uB85C \uD55C \uC815\uB958\uC7A5 \uB354 \uAC04 \uB4A4 \uB0B4\uB824\uC694.")),
        question("transit-story-card", "transit-instruction", "transit-card", "\uCE5C\uAD6C\uB4E4\uC740 \uBC84\uC2A4\uB97C \uD0C8 \uB54C \uAD50\uD1B5\uCE74\uB4DC\uB97C \uC5B4\uB514\uC5D0 \uB314\uC5B4\uC694?", "", ["\uCC3D\uBB38", "\uCE74\uB4DC \uB2E8\uB9D0\uAE30", "\uC88C\uC11D"], "b", "\uAD50\uD1B5\uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uACE0 \uBC84\uC2A4\uC5D0 \uD0D4\uC5B4\uC694.", transfer("\uC0C8 \uC2B9\uCC28 \uC548\uB0B4\uB97C \uC77D\uACE0 \uD544\uC694\uD55C \uD589\uB3D9\uC744 \uACE8\uB77C\uC694.", "\u201C\uBC84\uC2A4\uB97C \uD0C8 \uB54C \uAD50\uD1B5\uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uC138\uC694.\u201D", ["\uCE74\uB4DC \uC0AC\uC9C4\uC744 \uCC0D\uC5B4\uC694.", "\uCE74\uB4DC\uB97C \uC88C\uC11D\uC5D0 \uB194\uC694.", "\uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uC694."], "c", "\uC548\uB0B4\uC5D0 \uB530\uB77C \uCE74\uB4DC\uB97C \uCE74\uB4DC \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uC694."))
      ]),
      lesson("transit-apply", "apply", "\uB0B4\uB9B4 \uACF3\uC744 \uB193\uCE58\uC9C0 \uC54A\uC544\uC694", "\uC0C8 \uBC84\uC2A4 \uC548\uB0B4\uB97C \uC77D\uACE0 \uD544\uC694\uD55C \uD589\uB3D9\uC744 \uACE8\uB77C\uC694.", transitExpressions, [
        scene("mongle", "\uC624! \uC774\uBC88\uC5D0\uB294 \uB124 \uBAA9\uC801\uC9C0\uC57C! \uAC19\uC774 \uC548\uB0B4\uD45C\uB97C \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uBC8C\uB5A1 \uC77C\uC5B4\uB098\uC9C0 \uC54A\uC9C0. \uB0B4\uB9B4 \uACF3\uBD80\uD130 \uD655\uC778\uD558\uB294 \uAC70\uC57C."),
        scene("marine", "\uC774\uB3D9 \uD655\uC778. \uC774 \uBB38\uC81C\uC758 \uC548\uB0B4\uC5D0 \uB530\uB77C \uC120\uD0DD\uD558\uB77C.")
      ], [
        question("transit-apply-route", "transit-route", "transit-destination", "\uBCD1\uC6D0\uC5D0 \uAC00\uB824\uACE0 \uD574\uC694. \uBC84\uC2A4 \uBAA9\uC801\uC9C0\uB97C \uD655\uC778\uD558\uB294 \uB9D0\uC744 \uACE8\uB77C\uC694.", "", ["\uC774 \uBC84\uC2A4\uB294 \uBCD1\uC6D0\uC5D0 \uAC00\uC694?", "\uBCD1\uC6D0\uC740 \uBA87 \uC2DC\uC5D0 \uB2EB\uC544\uC694?", "\uBCD1\uC6D0 \uC606\uC5D0 \uC740\uD589\uC774 \uC788\uC5B4\uC694?"], "a", "\uAC00\uB824\uB294 \uC7A5\uC18C\uAC00 \uBCD1\uC6D0\uC778\uC9C0\uB97C \uBC84\uC2A4\uC5D0 \uB300\uD574 \uBB3C\uC5B4\uC694.", transfer("\uD559\uAD50\uC5D0 \uAC00\uB824\uACE0 \uD574\uC694. \uBC84\uC2A4 \uBAA9\uC801\uC9C0\uB97C \uD655\uC778\uD558\uB294 \uB9D0\uC744 \uACE8\uB77C\uC694.", "", ["\uD559\uAD50\uC5D0\uC11C \uC810\uC2EC\uC744 \uBA39\uC5B4\uC694?", "\uC774 \uBC84\uC2A4\uB294 \uD559\uAD50\uC5D0 \uAC00\uC694?", "\uD559\uAD50\uAC00 \uC0C8\uB85C \uC0DD\uACBC\uC5B4\uC694?"], "b", "\uAC00\uB824\uB294 \uC7A5\uC18C\uB97C \uD559\uAD50\uB85C \uBC14\uAFD4 \uBC84\uC2A4 \uBAA9\uC801\uC9C0\uB97C \uD655\uC778\uD574\uC694.")),
        question("transit-apply-alight", "transit-alighting", "transit-alight", "\uC9C0\uAE08 \uC5B4\uB5BB\uAC8C \uD560\uAE4C\uC694?", "\uBAA9\uC801\uC9C0\uB294 \uBCD1\uC6D0\uC774\uC5D0\uC694. \uC548\uB0B4\uBB38: \u201C\uC774\uBC88 \uC815\uB958\uC7A5\uC740 \uBCD1\uC6D0\uC785\uB2C8\uB2E4.\u201D", ["\uD55C \uC815\uB958\uC7A5 \uB354 \uAC00\uC694.", "\uBC84\uC2A4\uB97C \uB2E4\uC2DC \uD0C0\uC694.", "\uC774\uBC88 \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694."], "c", "\uC774\uBC88 \uC815\uB958\uC7A5\uC774 \uBAA9\uC801\uC9C0\uC778 \uBCD1\uC6D0\uC774\uBBC0\uB85C \uC9C0\uAE08 \uB0B4\uB824\uC694.", transfer("\uC9C0\uAE08 \uC5B4\uB5BB\uAC8C \uD560\uAE4C\uC694?", "\uBAA9\uC801\uC9C0\uB294 \uD559\uAD50\uC608\uC694. \uC548\uB0B4\uBB38: \u201C\uC774\uBC88 \uC815\uB958\uC7A5\uC740 \uC2DC\uC7A5\uC785\uB2C8\uB2E4. \uB2E4\uC74C \uC815\uB958\uC7A5\uC740 \uD559\uAD50\uC785\uB2C8\uB2E4.\u201D", ["\uB2E4\uC74C \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694.", "\uC774\uBC88 \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694.", "\uC2DC\uC7A5\uC5D0\uC11C \uAE30\uB2E4\uB824\uC694."], "a", "\uC9C0\uAE08\uC740 \uC2DC\uC7A5\uC774\uC5D0\uC694. \uBAA9\uC801\uC9C0\uC778 \uD559\uAD50\uB294 \uB2E4\uC74C \uC815\uB958\uC7A5\uC774\uC5D0\uC694.")),
        question("transit-apply-card", "transit-instruction", "transit-card", "\uC2B9\uCC28 \uC548\uB0B4\uC5D0 \uB9DE\uB294 \uD589\uB3D9\uC744 \uACE8\uB77C\uC694.", "\u201C\uAD50\uD1B5\uCE74\uB4DC\uB97C \uCC0D\uACE0 \uBC84\uC2A4 \uC548\uC73C\uB85C \uB4E4\uC5B4\uAC00\uC138\uC694.\u201D", ["\uCE74\uB4DC \uC0AC\uC9C4\uC744 \uCC0D\uACE0 \uB4E4\uC5B4\uAC00\uC694.", "\uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uACE0 \uB4E4\uC5B4\uAC00\uC694.", "\uCE74\uB4DC\uB97C \uC88C\uC11D\uC5D0 \uB193\uACE0 \uB4E4\uC5B4\uAC00\uC694."], "b", "\uC774 \uC0C1\uD669\uC5D0\uC11C \u2018\uCE74\uB4DC\uB97C \uCC0D\uB2E4\u2019\uB294 \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uB77C\uB294 \uB73B\uC774\uC5D0\uC694.", transfer("\uC774 \uBC84\uC2A4\uC758 \uD558\uCC28 \uC548\uB0B4\uC5D0 \uB9DE\uB294 \uD589\uB3D9\uC744 \uACE8\uB77C\uC694.", "\u201C\uB0B4\uB9AC\uAE30 \uC804\uC5D0 \uAD50\uD1B5\uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uC138\uC694.\u201D", ["\uBC84\uC2A4\uB97C \uD0C4 \uB4A4 \uC0AC\uC9C4\uC744 \uCC0D\uC5B4\uC694.", "\uCE74\uB4DC\uB97C \uC758\uC790\uC5D0 \uB450\uACE0 \uB0B4\uB824\uC694.", "\uB0B4\uB9AC\uAE30 \uC804\uC5D0 \uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uC694."], "c", "\uC548\uB0B4\uAC00 \uC9C0\uC815\uD55C \uB54C\uB294 \uB0B4\uB9AC\uAE30 \uC804\uC774\uACE0, \uD589\uB3D9\uC740 \uB2E8\uB9D0\uAE30\uC5D0 \uCE74\uB4DC\uB97C \uB300\uB294 \uAC83\uC774\uC5D0\uC694."))
      ])
    ]
  },
  {
    id: "plans",
    title: "\uC6B0\uB9AC\uC758 \uB0B4\uC77C \uC57D\uC18D",
    subtitle: "\uC2DC\uAC04\xB7\uC7A5\uC18C\uB97C \uC815\uD558\uACE0 \uB2A6\uC73C\uBA74 \uC54C\uB824\uC694",
    icon: "calendar",
    level: "\uAE30\uCD08 \uC0DD\uD65C \uD55C\uAD6D\uC5B4",
    skills: [skill("plans-time-reading", "\uC57D\uC18D \uB0A0\uC9DC\uC640 \uC2DC\uAC04 \uC77D\uAE30"), skill("plans-location", "\uB9CC\uB0A0 \uC7A5\uC18C \uD655\uC778\uD558\uAE30"), skill("plans-delay-message", "\uB2A6\uB294\uB2E4\uB294 \uC5F0\uB77D \uC774\uD574\uD558\uAE30")],
    lessons: [
      lesson("plans-expressions", "expressions", "\uC5B8\uC81C, \uC5B4\uB514\uC11C \uB9CC\uB0A0\uAE4C\uC694?", "\uC57D\uC18D\uC758 \uC2DC\uAC04\xB7\uC7A5\uC18C\xB7\uB2A6\uB294 \uC5F0\uB77D\uC744 \uAD6C\uBD84\uD574\uC694.", planExpressions, [
        scene("mongle", "\uC6B0\uC640! \uB0B4\uC77C\uB3C4 \uAC19\uC774 \uB180 \uC218 \uC788\uB124! \uC5B4\uB514\uC5D0\uC11C \uB9CC\uB0A0\uAE4C?"),
        scene("kkamong", "\uC57D\uC18D\uC740 \uC774 \uBAB8\uB3C4 \uC9C0\uD0A4\uC9C0. \uB0B4 \uC2DC\uACC4\uBD80\uD130 \uB9DE\uCDB0 \uB450\uB294 \uAC70\uC57C."),
        scene("marine", "\uC57D\uC18D \uC900\uBE44. \uB0A0\uC9DC, \uC2DC\uAC04, \uC7A5\uC18C \uD655\uC778.")
      ], [
        question("plans-expressions-time", "plans-time-reading", "plans-time", "\uC5B8\uC81C \uB9CC\uB098\uB294 \uC57D\uC18D\uC774\uC5D0\uC694?", "\u201C\uB0B4\uC77C \uC624\uD6C4 \uC138 \uC2DC\uC5D0 \uB9CC\uB098\uC694.\u201D", ["\uC624\uB298 \uC624\uD6C4 \uC138 \uC2DC", "\uB0B4\uC77C \uC624\uD6C4 \uC138 \uC2DC", "\uB0B4\uC77C \uC624\uC804 \uC138 \uC2DC"], "b", "\u2018\uB0B4\uC77C\u2019\uC774\uB77C\uB294 \uB0A0\uC9DC\uC640 \u2018\uC624\uD6C4 \uC138 \uC2DC\u2019\uB77C\uB294 \uC2DC\uAC04\uC744 \uD568\uAED8 \uC77D\uC5B4\uC694.", transfer("\uC5B8\uC81C \uB9CC\uB098\uB294 \uC57D\uC18D\uC774\uC5D0\uC694?", "\u201C\uC624\uB298 \uC624\uC804 \uC5F4 \uC2DC\uC5D0 \uB9CC\uB098\uC694.\u201D", ["\uB0B4\uC77C \uC624\uC804 \uC5F4 \uC2DC", "\uC624\uB298 \uC624\uD6C4 \uC5F4 \uC2DC", "\uC624\uB298 \uC624\uC804 \uC5F4 \uC2DC"], "c", "\uC0C8 \uC57D\uC18D\uC740 \uC624\uB298\uC774\uACE0 \uC2DC\uAC04\uC740 \uC624\uC804 \uC5F4 \uC2DC\uC608\uC694.")),
        question("plans-expressions-place", "plans-location", "plans-place", "\u2018\uC5B4\uB514\uC5D0\uC11C \uB9CC\uB0A0\uAE4C\uC694?\u2019\uB294 \uBB34\uC5C7\uC744 \uC815\uD558\uB824\uB294 \uB9D0\uC774\uC5D0\uC694?", "", ["\uB9CC\uB0A0 \uC7A5\uC18C", "\uB9CC\uB0A0 \uB0A0\uC9DC", "\uC0B4 \uBB3C\uAC74\uC758 \uAC00\uACA9"], "a", "\u2018\uC5B4\uB514\uC5D0\uC11C\u2019\uB294 \uB9CC\uB098\uB294 \uC7A5\uC18C\uB97C \uBB3B\uB294 \uB9D0\uC774\uC5D0\uC694.", transfer("\uB9CC\uB0A0 \uC7A5\uC18C\uB97C \uBB3C\uC5C8\uC5B4\uC694. \uC54C\uB9DE\uC740 \uB2F5\uC744 \uACE8\uB77C\uC694.", "\u201C\uC5B4\uB514\uC5D0\uC11C \uB9CC\uB0A0\uAE4C\uC694?\u201D", ["\uB0B4\uC77C \uB9CC\uB098\uC694.", "\uD559\uAD50 \uC55E\uC5D0\uC11C \uB9CC\uB098\uC694.", "\uC624\uD6C4 \uB450 \uC2DC\uC5D0 \uB9CC\uB098\uC694."], "b", "\uC7A5\uC18C\uB97C \uBB3C\uC5C8\uC73C\uBBC0\uB85C \u2018\uD559\uAD50 \uC55E\u2019\uC774\uB77C\uB294 \uC7A5\uC18C\uB97C \uB2F5\uD574\uC694.")),
        question("plans-expressions-delay", "plans-delay-message", "plans-delay", "\u2018\uC870\uAE08 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694\u2019\uB294 \uC5B4\uB5A4 \uC5F0\uB77D\uC774\uC5D0\uC694?", "\uCE5C\uAD6C\uC640 \uB9CC\uB098\uAE30\uB85C \uD55C \uB0A0\uC5D0 \uBCF4\uB0B8 \uBA54\uC2DC\uC9C0\uC608\uC694.", ["\uC57D\uC18D\uC744 \uC815\uD558\uC9C0 \uC54A\uACA0\uB2E4\uB294 \uC5F0\uB77D", "\uC77C\uCC0D \uB3C4\uCC29\uD588\uB2E4\uB294 \uC5F0\uB77D", "\uC57D\uC18D \uC2DC\uAC04\uBCF4\uB2E4 \uB2A6\uC744 \uAC83 \uAC19\uB2E4\uB294 \uC5F0\uB77D"], "c", "\uC544\uC9C1 \uB3C4\uCC29\uD558\uAE30 \uC804\uC774\uBA70 \uC57D\uC18D \uC2DC\uAC04\uBCF4\uB2E4 \uB2A6\uC744 \uAC00\uB2A5\uC131\uC744 \uC54C\uB9AC\uB294 \uB9D0\uC774\uC5D0\uC694.", transfer("\uC57D\uC18D \uC2DC\uAC04\uBCF4\uB2E4 \uB2A6\uAC8C \uB3C4\uCC29\uD560 \uAC83 \uAC19\uC544\uC694. \uC5B4\uB5A4 \uC5F0\uB77D\uC744 \uD560\uAE4C\uC694?", "", ["\uC870\uAE08 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694.", "\uBC8C\uC368 \uB3C4\uCC29\uD588\uC5B4\uC694.", "\uC77C\uCC0D \uC654\uC5B4\uC694."], "a", "\uB2A6\uC744 \uAC83 \uAC19\uC744 \uB54C \uC0C1\uD669\uC744 \uBBF8\uB9AC \uC54C\uB824 \uC8FC\uB294 \uD45C\uD604\uC774\uC5D0\uC694."))
      ]),
      lesson("plans-story", "story", "\uC138 \uC2DC, \uB3C4\uC11C\uAD00 \uC55E", "\uC57D\uC18D \uBA54\uC2DC\uC9C0\uC640 \uAE4C\uBABD\uC758 \uB2A6\uB294 \uC5F0\uB77D\uC744 \uC774\uD574\uD574\uC694.", planExpressions, [
        scene("narrator", "\uBABD\uAE00\uC740 \uB2E4\uC74C \uB0A0 \uC138 \uCE5C\uAD6C\uAC00 \uB2E4\uC2DC \uB9CC\uB0A0 \uC57D\uC18D \uCE74\uB4DC\uB97C \uB9CC\uB4E4\uC5B4\uC694."),
        scene("mongle", "\uC6B0\uC640! \uB0B4\uC77C\uB3C4 \uAC19\uC774 \uB9CC\uB098\uC790! \uC624\uD6C4 \uC138 \uC2DC \uC5B4\uB54C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uC57D\uC18D \uC804\uC5D0 \uB3C4\uCC29\uD558\uC9C0. \uB3C4\uC11C\uAD00 \uC55E \uBCA4\uCE58\uAC00 \uB531\uC774\uC57C."),
        scene("marine", "\uC57D\uC18D \uAE30\uB85D. \uB0B4\uC77C \uC624\uD6C4 \uC138 \uC2DC. \uB3C4\uC11C\uAD00 \uC55E \uBCA4\uCE58."),
        scene("narrator", "\uB2E4\uC74C \uB0A0, \uBABD\uAE00\uACFC \uB9C8\uB9B0\uC774 \uBCA4\uCE58\uC5D0 \uC640 \uC788\uC5B4\uC694. \uAE4C\uBABD\uC774 \uBA54\uC2DC\uC9C0\uB97C \uBCF4\uB0B4\uC694."),
        scene("kkamong", "\uB0B4\uAC00 \uAF43\uC744 \uC870\uAE08 \uACE8\uB790\uAC70\uB4E0. \u2018\uC870\uAE08 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694.\u2019 \u2026\uC870\uAE08\uB9CC."),
        scene("mongle", "\uC624! \uAF43\uB3C4 \uAC19\uC774 \uC624\uB294\uAD6C\uB098! \uC5EC\uAE30\uC11C \uAE30\uB2E4\uB9B4\uAE4C?"),
        scene("marine", "\uC5F0\uB77D \uD655\uC778. \uB3C4\uC11C\uAD00 \uC55E\uC5D0\uC11C \uB300\uAE30. \u2026\uAE4C\uBABD \uC790\uB9AC \uD655\uBCF4."),
        scene("narrator", "\uAE4C\uBABD\uC774 \uC791\uC740 \uAF43 \uC138 \uC1A1\uC774\uB97C \uAC00\uC9C0\uACE0 \uC640\uC694. \uCE5C\uAD6C\uB9C8\uB2E4 \uD55C \uC1A1\uC774\uC529 \uAC74\uB124\uC918\uC694."),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uBE48\uC790\uB9AC\uB3C4 \uAF43\uC73C\uB85C \uCC44\uC6B0\uC9C0. \u2026\uB108\uD76C \uBAAB\uC774\uC57C."),
        scene("marine", "\uC804\uC6D0 \uB3C4\uCC29. \uAF43, \uC14B. \uC57D\uC18D \uC644\uB8CC. \u2026\uAE30\uB2E4\uB9BC\uB3C4 \uB098\uC058\uC9C0 \uC54A\uB2E4.")
      ], [
        question("plans-story-time", "plans-time-reading", "plans-time", "\uCC98\uC74C \uC57D\uC18D \uCE74\uB4DC\uC5D0 \uC801\uC740 \uC2DC\uAC04\uC740 \uC5B8\uC81C\uC608\uC694?", "", ["\uB0B4\uC77C \uC624\uC804 \uC138 \uC2DC", "\uC624\uB298 \uC624\uD6C4 \uC138 \uC2DC", "\uB0B4\uC77C \uC624\uD6C4 \uC138 \uC2DC"], "c", "\uCC98\uC74C \uCE74\uB4DC\uB97C \uB9CC\uB4E4 \uB54C \uC815\uD55C \uC57D\uC18D\uC740 \uB0B4\uC77C \uC624\uD6C4 \uC138 \uC2DC\uC608\uC694.", transfer("\uC0C8 \uC57D\uC18D \uCE74\uB4DC\uC5D0 \uC801\uD78C \uC2DC\uAC04\uC744 \uACE8\uB77C\uC694.", "\uC57D\uC18D \uCE74\uB4DC: \u201C\uD1A0\uC694\uC77C \uC624\uC804 \uC5F4\uD55C \uC2DC\u201D", ["\uD1A0\uC694\uC77C \uC624\uD6C4 \uC5F4\uD55C \uC2DC", "\uD1A0\uC694\uC77C \uC624\uC804 \uC5F4\uD55C \uC2DC", "\uC77C\uC694\uC77C \uC624\uC804 \uC5F4\uD55C \uC2DC"], "b", "\uC694\uC77C\xB7\uC624\uC804\xB7\uC5F4\uD55C \uC2DC\uB97C \uBAA8\uB450 \uD655\uC778\uD574\uC694.")),
        question("plans-story-place", "plans-location", "plans-place", "\uC138 \uCE5C\uAD6C\uB294 \uC5B4\uB514\uC5D0\uC11C \uB9CC\uB0AC\uC5B4\uC694?", "", ["\uB3C4\uC11C\uAD00 \uC55E \uBCA4\uCE58", "\uB3C4\uC11C\uAD00 \uC548 \uAD50\uC2E4", "\uCE74\uD398 \uCC3D\uAC00"], "a", "\uC57D\uC18D \uAE30\uB85D\uACFC \uAE30\uB2E4\uB9AC\uB294 \uC7A5\uBA74\uC758 \uC7A5\uC18C\uB294 \uB3C4\uC11C\uAD00 \uC55E \uBCA4\uCE58\uC608\uC694.", transfer("\uC0C8 \uBA54\uC2DC\uC9C0\uB97C \uC77D\uACE0 \uB9CC\uB0A0 \uC7A5\uC18C\uB97C \uACE8\uB77C\uC694.", "\u201C\uACF5\uC6D0 \uC785\uAD6C\uC5D0\uC11C \uB9CC\uB098\uC694. \uC548\uC758 \uBCA4\uCE58\uAC00 \uC544\uB2C8\uB77C \uC785\uAD6C\uC608\uC694.\u201D", ["\uACF5\uC6D0 \uC548 \uBCA4\uCE58", "\uB3C4\uC11C\uAD00 \uC785\uAD6C", "\uACF5\uC6D0 \uC785\uAD6C"], "c", "\u2018\uC785\uAD6C\u2019\uB77C\uB294 \uC7A5\uC18C\uC640 \u2018\uC548\uC758 \uBCA4\uCE58\uAC00 \uC544\uB2C8\uB77C\u2019\uB77C\uB294 \uD655\uC778\uC744 \uD568\uAED8 \uC77D\uC5B4\uC694.")),
        question("plans-story-delay", "plans-delay-message", "plans-delay", "\uAE4C\uBABD\uC758 \u2018\uC870\uAE08 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694\u2019\uB77C\uB294 \uC5F0\uB77D \uB4A4 \uCE5C\uAD6C\uB4E4\uC740 \uBB34\uC5C7\uC744 \uD588\uC5B4\uC694?", "", ["\uC57D\uC18D\uC744 \uBAA8\uB450 \uCDE8\uC18C\uD588\uC5B4\uC694.", "\uB3C4\uC11C\uAD00 \uC55E\uC5D0\uC11C \uAE30\uB2E4\uB838\uC5B4\uC694.", "\uBC14\uB85C \uC9D1\uC73C\uB85C \uB3CC\uC544\uAC14\uC5B4\uC694."], "b", "\uBABD\uAE00\uACFC \uB9C8\uB9B0\uC740 \uB2A6\uB294 \uC5F0\uB77D\uC744 \uD655\uC778\uD558\uACE0 \uC57D\uC18D \uC7A5\uC18C\uC5D0\uC11C \uAE30\uB2E4\uB838\uC5B4\uC694.", transfer("\uC0C8 \uBA54\uC2DC\uC9C0\uB97C \uC77D\uACE0 \uB3C4\uCC29 \uC0C1\uD0DC\uB97C \uACE8\uB77C\uC694.", "\u201C\uBC84\uC2A4\uB97C \uB193\uCCE4\uC5B4\uC694. \uC2ED \uBD84 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694.\u201D", ["\uC544\uC9C1 \uB3C4\uCC29 \uC804\uC774\uACE0 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694.", "\uBC8C\uC368 \uC57D\uC18D \uC7A5\uC18C\uC5D0 \uB3C4\uCC29\uD588\uC5B4\uC694.", "\uC57D\uC18D\uC774 \uCDE8\uC18C\uB410\uC5B4\uC694."], "a", "\uBC84\uC2A4\uB97C \uB193\uCCD0 \uC57D\uC18D \uC2DC\uAC04\uBCF4\uB2E4 \uB2A6\uC744 \uAC83 \uAC19\uB2E4\uB294 \uC5F0\uB77D\uC774\uC5D0\uC694. \uCDE8\uC18C\uB77C\uB294 \uB9D0\uC740 \uC5C6\uC5B4\uC694."))
      ]),
      lesson("plans-apply", "apply", "\uB0B4 \uC57D\uC18D \uBA54\uC2DC\uC9C0", "\uC0C8 \uC57D\uC18D\uC758 \uC2DC\uAC04\uACFC \uC7A5\uC18C\uB97C \uD655\uC778\uD558\uACE0 \uD544\uC694\uD55C \uC5F0\uB77D\uC744 \uACE8\uB77C\uC694.", planExpressions, [
        scene("mongle", "\uC624! \uB124 \uC57D\uC18D\uC740 \uC5B8\uC81C\uC57C? \uAC19\uC774 \uBA54\uC2DC\uC9C0 \uC77D\uC5B4 \uBCFC\uAE4C?"),
        scene("kkamong", "\uB0B4 \uAF43\uC740 \uC138 \uC1A1\uC774\uC600\uC9C0. \uB2E4\uC74C\uC5D4 \uB0B4\uAC00 \uC2DC\uAC04\uB3C4 \uB531 \uB9DE\uCDB0 \uC624\uC9C0."),
        scene("marine", "\uBA54\uC2DC\uC9C0 \uD655\uC778. \uC2DC\uAC04\uACFC \uC7A5\uC18C\uB97C \uBD84\uB9AC\uD574 \uC77D\uC5B4\uB77C.")
      ], [
        question("plans-apply-time", "plans-time-reading", "plans-time", "\uC5B8\uC81C \uAC00\uC57C \uD574\uC694?", "\uCE5C\uAD6C\uC758 \uBA54\uC2DC\uC9C0: \u201C\uB0B4\uC77C \uC624\uD6C4 \uB450 \uC2DC\uC5D0 \uD559\uAD50 \uC55E\uC5D0\uC11C \uB9CC\uB098\uC694.\u201D", ["\uB0B4\uC77C \uC624\uD6C4 \uB450 \uC2DC", "\uC624\uB298 \uC624\uD6C4 \uB450 \uC2DC", "\uB0B4\uC77C \uC624\uC804 \uB450 \uC2DC"], "a", "\uB0A0\uC9DC\uB294 \uB0B4\uC77C, \uC2DC\uAC04\uC740 \uC624\uD6C4 \uB450 \uC2DC\uC608\uC694.", transfer("\uC5B8\uC81C \uAC00\uC57C \uD574\uC694?", "\uCE5C\uAD6C\uC758 \uBA54\uC2DC\uC9C0: \u201C\uC624\uB298 \uC624\uD6C4 \uB2E4\uC12F \uC2DC\uC5D0 \uCE74\uD398 \uC55E\uC5D0\uC11C \uB9CC\uB098\uC694.\u201D", ["\uB0B4\uC77C \uC624\uD6C4 \uB2E4\uC12F \uC2DC", "\uC624\uB298 \uC624\uC804 \uB2E4\uC12F \uC2DC", "\uC624\uB298 \uC624\uD6C4 \uB2E4\uC12F \uC2DC"], "c", "\uC0C8 \uC57D\uC18D\uC740 \uC624\uB298 \uC624\uD6C4 \uB2E4\uC12F \uC2DC\uC608\uC694. \uC7A5\uC18C\uC640 \uC2DC\uAC04\uC744 \uB098\uB204\uC5B4 \uC77D\uC5B4\uC694.")),
        question("plans-apply-place", "plans-location", "plans-place", "\uC5B4\uB514\uC5D0\uC11C \uAE30\uB2E4\uB9B4\uAE4C\uC694?", "\u201C\uC5ED \uC548\uC774 \uC544\uB2C8\uB77C \uC5ED \uC55E\uC5D0\uC11C \uB9CC\uB098\uC694.\u201D", ["\uC5ED \uC548", "\uC5ED \uB4A4", "\uC5ED \uC55E"], "c", "\uBA54\uC2DC\uC9C0\uB294 \u2018\uC5ED \uC548\u2019\uC774 \uC544\uB2C8\uB77C \u2018\uC5ED \uC55E\u2019\uC774\uB77C\uACE0 \uD655\uC778\uD574 \uC918\uC694.", transfer("\uC5B4\uB514\uC5D0\uC11C \uAE30\uB2E4\uB9B4\uAE4C\uC694?", "\u201C\uD559\uAD50 \uC548\uC774 \uC544\uB2C8\uB77C \uD559\uAD50 \uC55E\uC5D0\uC11C \uB9CC\uB098\uC694.\u201D", ["\uD559\uAD50 \uC548", "\uD559\uAD50 \uC55E", "\uD559\uAD50 \uB4A4"], "b", "\u2018\uD559\uAD50 \uC548\u2019\uC740 \uC81C\uC678\uD558\uACE0 \u2018\uD559\uAD50 \uC55E\u2019\uC5D0\uC11C \uB9CC\uB098\uC694.")),
        question("plans-apply-delay", "plans-delay-message", "plans-delay", "\uCE5C\uAD6C\uC5D0\uAC8C \uBCF4\uB0BC \uC5F0\uB77D\uC744 \uACE8\uB77C\uC694.", "\uC57D\uC18D \uC7A5\uC18C\uC5D0 \uAC00\uB294 \uBC84\uC2A4\uB97C \uB193\uCCE4\uC5B4\uC694. \uC57D\uC18D \uC2DC\uAC04\uBCF4\uB2E4 \uB2A6\uAC8C \uB3C4\uCC29\uD560 \uAC83 \uAC19\uC544\uC694.", ["\uBC8C\uC368 \uB3C4\uCC29\uD588\uC5B4\uC694.", "\uC870\uAE08 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694.", "\uC77C\uCC0D \uB3C4\uCC29\uD588\uC5B4\uC694."], "b", "\uC544\uC9C1 \uB3C4\uCC29\uD558\uC9C0 \uC54A\uC558\uACE0 \uB2A6\uC744 \uAC83 \uAC19\uC73C\uBBC0\uB85C \uBBF8\uB9AC \uC5F0\uB77D\uD574\uC694.", transfer("\uCE5C\uAD6C\uC5D0\uAC8C \uBCF4\uB0BC \uC5F0\uB77D\uC744 \uACE8\uB77C\uC694.", "\uAE38\uC774 \uB9C9\uD600 \uC57D\uC18D \uC2DC\uAC04\uBCF4\uB2E4 \uC2ED \uBD84 \uB2A6\uAC8C \uB3C4\uCC29\uD560 \uAC83 \uAC19\uC544\uC694.", ["\uC2ED \uBD84 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694.", "\uC2ED \uBD84 \uC77C\uCC0D \uC654\uC5B4\uC694.", "\uC9C0\uAE08 \uB3C4\uCC29\uD588\uC5B4\uC694."], "a", "\uB2A6\uC744 \uC608\uC0C1 \uC2DC\uAC04\uC744 \uD568\uAED8 \uC54C\uB824 \uC8FC\uBA74 \uCE5C\uAD6C\uAC00 \uAE30\uB2E4\uB9AC\uB294 \uB370 \uB3C4\uC6C0\uC774 \uB3FC\uC694."))
      ])
    ]
  }
];
var LESSONS = PACKS.flatMap((pack) => pack.lessons.map((item) => ({ ...item, packId: pack.id })));
var packById = (id) => PACKS.find((pack) => pack.id === id) || null;
var lessonById = (id) => LESSONS.find((item) => item.id === id) || null;

// experiences/synk-world-app/cafe-activity.mjs
var CAFE_LESSON_ID = "cafe-apply";
var CAFE_COMPOSE_ID = "cafe-compose";
var phases = ["welcome", "choose", "repair", "response", "break", "complete"];
var clone = (value) => JSON.parse(JSON.stringify(value));
var CAFE_SEATS = { window: "\uCC3D\uAC00 \uC790\uB9AC", garden: "\uD654\uBD84 \uC606 \uC790\uB9AC" };
var CAFE_STEPS = [
  {
    name: "\uC74C\uB8CC \uC8FC\uBB38",
    goal: "\uBABD\uAE00\uACFC \uB458\uC774 \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB97C \uD55C \uC794\uC529 \uB9C8\uC154\uC694.",
    staff: "\uC5B4\uC11C \uC624\uC138\uC694. \uC5B4\uB5A4 \uC74C\uB8CC\uB85C \uB4DC\uB9B4\uAE4C\uC694?",
    friend: "\uC624! \uB0B4 \uCEF5\uB3C4 \uAC19\uC774 \uC8FC\uBB38\uD574 \uC904\uB798?",
    speaker: "mongle",
    hint: "\uB458\uC774 \uD55C \uC794\uC529\uC774\uBA74 \uB450 \uC794\uC774\uC5D0\uC694. \uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uB450 \uC794 \uC8FC\uC138\uC694.",
    next: "\uB9C8\uC2E4 \uACF3 \uC815\uD558\uAE30",
    options: { a: { label: "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \xB7 \uD55C \uC794", drink: "cold", count: 1, response: "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794\uC774\uC694. \uCE5C\uAD6C\uBD84\uB3C4 \uD568\uAED8 \uB4DC\uC2DC\uB098\uC694?", friend: "\uC5B4? \uCEF5\uC774 \uD558\uB098\uB124! \uC6B0\uB9AC \uAC19\uC774 \uD55C \uC794\uC529 \uB9C8\uC2DC\uC790!" }, b: { label: "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \xB7 \uB450 \uC794", drink: "cold", count: 2, response: "\uB124, \uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uB450 \uC794 \uC8FC\uBB38\uBC1B\uC558\uC5B4\uC694.", friend: "\uC6B0\uC640! \uD558\uB098\uB294 \uB124 \uCEF5, \uD558\uB098\uB294 \uB0B4 \uCEF5\uC774\uC57C!" }, c: { label: "\uB530\uB73B\uD55C \uC8FC\uC2A4 \xB7 \uB450 \uC794", drink: "warm", count: 2, response: "\uB530\uB73B\uD55C \uC8FC\uC2A4 \uB450 \uC794\uC774\uC694. \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB97C \uCC3E\uC73C\uC168\uB358 \uAC83 \uAC19\uC740\uB370, \uB9DE\uC744\uAE4C\uC694?", friend: "\uC624! \uC624\uB298\uC740 \uC2DC\uC6D0\uD55C \uC8FC\uC2A4\uAC00 \uB9C8\uC2DC\uACE0 \uC2F6\uC5B4!" } }
  },
  {
    name: "\uB9C8\uC2E4 \uACF3",
    goal: "\uBABD\uAE00\uACFC \uCE74\uD398 \uC548\uC758 \uD14C\uC774\uBE14\uC5D0\uC11C \uB9C8\uC2DC\uB824\uACE0 \uD574\uC694.",
    staff: "\uAC00\uC838\uAC00\uC2E4 \uAC74\uAC00\uC694?",
    friend: "\uAC19\uC774 \uC549\uC744 \uC790\uB9AC\uAC00 \uC788\uB124! \uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2DC\uC790!",
    speaker: "mongle",
    hint: "\uCE74\uD398 \uC548\uC758 \uD14C\uC774\uBE14\uC5D0\uC11C \uB9C8\uC2E4 \uB54C\uB294 \uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.",
    next: "\uC8FC\uC2A4 \uBC1B\uC544 \uC790\uB9AC\uB85C \uAC00\uAE30",
    options: { a: { label: "\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", drink: "cold", count: 2, response: "\uD3EC\uC7A5\uC73C\uB85C \uC900\uBE44\uD560\uAC8C\uC694. \uCE74\uD398 \uC548\uC5D0 \uC549\uC73C\uC2E4 \uAC70\uBA74 \uB9E4\uC7A5 \uC774\uC6A9\uC73C\uB85C \uBC14\uAFD4 \uB4DC\uB9B4\uAE4C\uC694?", friend: "\uC624! \uC6B0\uB9AC\uB294 \uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2DC\uB824\uACE0 \uD588\uC5B4!" }, b: { label: "\uC544\uC9C1 \uC548 \uB9C8\uC168\uC5B4\uC694.", drink: "cold", count: 2, response: "\uB124. \uC74C\uB8CC\uB97C \uCE74\uD398 \uC548\uC5D0\uC11C \uB4DC\uC2E4\uC9C0, \uBC16\uC73C\uB85C \uAC00\uC838\uAC00\uC2E4\uC9C0 \uC54C\uB824 \uC8FC\uC138\uC694.", friend: "\uAC19\uC774 \uC549\uC544\uC11C \uB9C8\uC2E0\uB2E4\uACE0 \uB9D0\uD574 \uBCFC\uAE4C?" }, c: { label: "\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", drink: "cold", count: 2, response: "\uB124, \uB9E4\uC7A5 \uCEF5\uC5D0 \uC900\uBE44\uD588\uC5B4\uC694. \uB450 \uC794 \uBAA8\uB450 \uAC00\uC838\uAC00\uC138\uC694.", friend: "\uC6B0\uC640! \uAC19\uC774 \uC549\uC744 \uC790\uB9AC\uB3C4 \uACE8\uB77C \uBCFC\uAE4C?" } }
  },
  {
    name: "\uD3EC\uC7A5 \uBD80\uD0C1",
    goal: "\uC774\uBC88\uC5D0\uB294 \uC8FC\uBB38\uD55C \uCC28\uB97C \uAC00\uC9C0\uACE0 \uD559\uAD50\uC5D0 \uAC00\uB824\uACE0 \uD574\uC694.",
    staff: "\uB530\uB73B\uD55C \uCC28\uAC00 \uC900\uBE44\uB410\uC5B4\uC694. \uB9E4\uC7A5\uC5D0\uC11C \uB4DC\uC2DC\uB098\uC694?",
    friend: "\uD559\uAD50 \uAC08 \uC2DC\uAC04 \uD655\uC778. \uCC28\uB294 \uBC16\uC73C\uB85C \uAC00\uC838\uAC04\uB2E4.",
    speaker: "marine",
    hint: "\uC74C\uB8CC\uB97C \uD559\uAD50\uB85C \uAC00\uC838\uAC00\uB824\uBA74 \uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.",
    next: "\uCC28 \uBC1B\uC544 \uD559\uAD50\uB85C \uAC00\uAE30",
    options: { a: { label: "\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", drink: "takeout", count: 1, response: "\uB124, \uB69C\uAED1\uC744 \uB2EB\uC544 \uD3EC\uC7A5\uD588\uC5B4\uC694. \uB530\uB73B\uD558\uB2C8 \uC870\uC2EC\uD574\uC11C \uAC00\uC838\uAC00\uC138\uC694.", friend: "\uD3EC\uC7A5 \uD655\uC778. \u2026\uB530\uB73B\uD560 \uB54C \uAC00\uC838\uAC00\uC790." }, b: { label: "\uB9E4\uC7A5\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694.", drink: "tea", count: 1, response: "\uB9E4\uC7A5 \uCEF5\uC73C\uB85C \uB4DC\uB9B4\uAC8C\uC694. \uD559\uAD50\uB85C \uAC00\uC838\uAC00\uC2DC\uB824\uBA74 \uD3EC\uC7A5 \uCEF5\uC73C\uB85C \uBC14\uAFD4 \uB4DC\uB9B4\uAE4C\uC694?", friend: "\uBAA9\uC801\uC9C0, \uD559\uAD50. \uBC16\uC73C\uB85C \uAC00\uC838\uAC08 \uCEF5\uC774 \uD544\uC694\uD558\uB2E4." }, c: { label: "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694.", drink: null, count: 0, response: "\uCDE8\uC18C\uD558\uC2DC\uACA0\uC5B4\uC694? \uD559\uAD50\uC5D0 \uAC00\uC838\uAC08 \uCC28\uAC00 \uD544\uC694\uD558\uC2DC\uBA74 \uC8FC\uBB38\uC744 \uC720\uC9C0\uD558\uACE0 \uD3EC\uC7A5\uD574 \uB4DC\uB9B4\uAC8C\uC694.", friend: "\uCC28\uAC00 \uC544\uC9C1 \uD544\uC694\uD558\uB2E4. \uD3EC\uC7A5\uC744 \uBD80\uD0C1\uD558\uB77C." } }
  }
];
var order = (drink, count, label, place = "\uB9E4\uC7A5 \uC774\uC6A9") => ({ drink, count, label, place });
var CAFE_VISITS = [
  {
    id: CAFE_LESSON_ID,
    number: 1,
    title: "\uAC19\uC774 \uB9C8\uC2E4 \uC8FC\uC2A4, \uB0B4\uAC00 \uC8FC\uBB38\uD574 \uBCFC\uAE4C?",
    caption: "\uC624\uB298\uC740 \uB0B4\uAC00 \uC8FC\uBB38\uD558\uB294 \uB0A0",
    description: "\uBABD\uAE00\uACFC \uCE74\uD398\uC5D0\uC11C \uC26C\uACE0, \uD559\uAD50 \uAC00\uB294 \uB9C8\uB9B0\uC5D0\uAC8C \uCC28\uB97C \uCC59\uACA8 \uC918\uC694.",
    steps: CAFE_STEPS,
    seatStep: 1,
    breakStep: 2,
    ending: { title: "\uC8FC\uBB38\uBD80\uD130 \uCEF5\uC744 \uBC1B\uAE30\uAE4C\uC9C0.", text: "\uCE5C\uAD6C\uC640 \uB9C8\uC2E4 \uC8FC\uC2A4 \uB450 \uC794, \uB9C8\uB9B0\uC774 \uD559\uAD50\uC5D0 \uAC00\uC838\uAC08 \uCC28 \uD55C \uC794\uC744 \uCC59\uACBC\uC5B4\uC694.", orders: [order("cold", 2, "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uB450 \uC794", "\uB9E4\uC7A5\uC5D0\uC11C \uD568\uAED8"), order("takeout", 1, "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794", "\uD559\uAD50\uB85C \uAC00\uC838\uAC00\uAE30")] }
  },
  {
    id: "cafe-visit-taste",
    number: 2,
    title: "\uAE4C\uBABD\uC758 \uB530\uB73B\uD55C \uD55C \uC794",
    caption: "\uB450 \uBC88\uC9F8 \uBC29\uBB38 \xB7 \uCE5C\uAD6C\uC758 \uCDE8\uD5A5",
    description: "\uB530\uB73B\uD55C \uCC28\uAC00 \uB9C8\uC2DC\uACE0 \uC2F6\uC740 \uAE4C\uBABD. \uCE5C\uAD6C\uAC00 \uC6D0\uD558\uB294 \uC74C\uB8CC\uB97C \uAC19\uC774 \uACE8\uB77C\uC694.",
    seatStep: 2,
    steps: [
      { name: "\uCE5C\uAD6C\uC758 \uCDE8\uD5A5", staff: "\uC5B4\uC11C \uC624\uC138\uC694. \uC624\uB298\uC740 \uC5B4\uB5A4 \uC74C\uB8CC\uB97C \uB4DC\uB9B4\uAE4C\uC694?", speaker: "kkamong", friend: "\uC774 \uBAB8\uC740 \uB530\uB73B\uD55C \uCC28\uAC00 \uB9C8\uC2DC\uACE0 \uC2F6\uAD70. \u2026\uB124 \uCEF5\uB3C4 \uAC19\uC774.", hint: "\uAE4C\uBABD\uC774 \uC6D0\uD558\uB294 \uAC83\uC740 \uB530\uB73B\uD55C \uCC28\uC608\uC694. \uC885\uB958\uC640 \uC628\uB3C4\uB97C \uD568\uAED8 \uBD10\uC694.", next: "\uD568\uAED8 \uB9C8\uC2E4 \uC218\uB7C9 \uC815\uD558\uAE30", menu: true, before: order(null, 0, "\uAE4C\uBABD\uC758 \uCDE8\uD5A5\uC744 \uACE8\uB77C \uC8FC\uC138\uC694", "\uB9C8\uC2E4 \uACF3\uC740 \uC544\uC9C1"), options: {
        a: { ...order("warm", 1, "\uB530\uB73B\uD55C \uC8FC\uC2A4 \uD55C \uC794"), response: "\uB530\uB73B\uD55C \uC8FC\uC2A4 \uD55C \uC794\uC774\uC694. \uCE5C\uAD6C\uBD84\uC740 \uCC28\uB97C \uC6D0\uD558\uC168\uB358 \uAC83 \uAC19\uC740\uB370, \uB2E4\uC2DC \uD655\uC778\uD560\uAE4C\uC694?", friend: "\uC774 \uBAB8\uC740 \uC624\uB298 \uCC28 \uCABD\uC774 \uB354 \uB04C\uB9AC\uB294\uAD70." },
        b: { ...order("tea", 1, "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794"), response: "\uB124, \uB530\uB73B\uD55C \uCC28\uB85C \uC8FC\uBB38\uBC1B\uC558\uC5B4\uC694. \uD568\uAED8 \uB4DC\uC2E4 \uC218\uB7C9\uB3C4 \uC54C\uB824 \uC8FC\uC138\uC694.", friend: "\uD6D7, \uB0B4 \uCDE8\uD5A5\uC744 \uC54C\uC544\uBD24\uAD70. \u2026\uB530\uB73B\uD55C \uAC78\uB85C." },
        c: { ...order("cold", 1, "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794"), response: "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794\uC774\uC694. \uC624\uB298\uC740 \uB530\uB73B\uD55C \uCC28\uB85C \uBC14\uAFB8\uC2E4\uAE4C\uC694?", friend: "\uB0B4\uAC00 \uC6D0\uD558\uB294 \uAC74 \uB530\uB73B\uD55C \uCC28\uC57C. \uC624\uB298\uC740." }
      } },
      { name: "\uD568\uAED8 \uB9C8\uC2E4 \uC218\uB7C9", staff: "\uB530\uB73B\uD55C \uCC28\uB97C \uBA87 \uC794 \uC900\uBE44\uD560\uAE4C\uC694?", speaker: "marine", friend: "\uC218\uB7C9 \uD655\uC778. \uAE4C\uBABD \uD55C \uC794, \uB124 \uCEF5 \uD55C \uC794. \uB458.", hint: "\uB450 \uC0AC\uB78C\uC774 \uD55C \uC794\uC529 \uB9C8\uC2DC\uB2C8\uAE4C \uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uC8FC\uC138\uC694.", next: "\uB9C8\uC2E4 \uACF3 \uC54C\uB824 \uC8FC\uAE30", menu: true, before: order("tea", 1, "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794", "\uC218\uB7C9 \uD655\uC778 \uC911"), options: {
        a: { ...order("tea", 1, "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794"), response: "\uD55C \uC794\uC774\uC694. \uB450 \uBD84\uC774 \uD55C \uC794\uC529 \uB4DC\uC2DC\uBA74 \uB450 \uC794\uC73C\uB85C \uBC14\uAFD4 \uB4DC\uB9B4\uAE4C\uC694?", friend: "\uC218\uB7C9 \uC7AC\uD655\uC778. \uD568\uAED8 \uB9C8\uC2E4 \uCEF5, \uB458." },
        b: { ...order("tea", 3, "\uB530\uB73B\uD55C \uCC28 \uC138 \uC794"), response: "\uC138 \uC794\uC774\uC694. \uB450 \uBD84\uC758 \uCEF5\uB9CC \uD544\uC694\uD558\uBA74 \uB450 \uC794\uC73C\uB85C \uBC14\uAFC0 \uC218 \uC788\uC5B4\uC694.", friend: "\uC8FC\uBB38 \uB300\uC0C1, \uB450 \uC0AC\uB78C. \uD544\uC694\uD55C \uCEF5, \uB458." },
        c: { ...order("tea", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794"), response: "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794, \uD655\uC778\uD588\uC5B4\uC694. \uC5EC\uAE30\uC11C \uB4DC\uC2DC\uB098\uC694?", friend: "\uC218\uB7C9 \uD655\uC778 \uC644\uB8CC. \uB450 \uC0AC\uB78C\uC758 \uCEF5, \uB458." }
      } },
      { name: "\uD568\uAED8 \uC26C\uB294 \uC790\uB9AC", staff: "\uAC00\uC838\uAC00\uC2E4 \uAC74\uAC00\uC694, \uC5EC\uAE30\uC11C \uB4DC\uC2E4 \uAC74\uAC00\uC694?", speaker: "mongle", friend: "\uC624! \uBE44\uAC00 \uADF8\uCE60 \uB54C\uAE4C\uC9C0 \uAC19\uC774 \uC5EC\uAE30\uC11C \uC26C\uC790!", hint: "\uCE74\uD398 \uC548\uC5D0\uC11C \uC26C\uBA70 \uB9C8\uC2DC\uB2C8\uAE4C \uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", next: "\uCC28 \uBC1B\uC544 \uCE5C\uAD6C\uC640 \uC549\uAE30", before: order("tea", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794", "\uB9C8\uC2E4 \uACF3 \uD655\uC778 \uC911"), options: {
        a: { ...order("tea", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794"), response: "\uB124, \uB9E4\uC7A5 \uCEF5 \uB450 \uC794 \uC900\uBE44\uD588\uC5B4\uC694. \uD3B8\uD55C \uC790\uB9AC\uB97C \uACE8\uB77C \uC8FC\uC138\uC694.", friend: "\uC6B0\uC640! \uB530\uB73B\uD55C \uCEF5 \uB450 \uAC1C\uC57C! \uAC19\uC774 \uC549\uC790!" },
        b: { ...order("takeout", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794", "\uD3EC\uC7A5 \uC694\uCCAD"), response: "\uD3EC\uC7A5\uC73C\uB85C \uC900\uBE44\uD560\uAC8C\uC694. \uCE74\uD398 \uC548\uC5D0\uC11C \uC26C\uC2E4 \uAC70\uBA74 \uB9E4\uC7A5 \uC774\uC6A9\uC73C\uB85C \uBC14\uAFC0\uAE4C\uC694?", friend: "\uC624! \uC6B0\uB9AC\uB294 \uC548\uC5D0\uC11C \uAC19\uC774 \uC26C\uB824\uACE0 \uD588\uC5B4!" },
        c: { ...order(null, 0, "\uCDE8\uC18C \uD655\uC778 \uC911", "\uC544\uC9C1 \uC218\uB839\uD558\uC9C0 \uC54A\uC74C"), response: "\uCDE8\uC18C\uD558\uC2DC\uACA0\uC5B4\uC694? \uB530\uB73B\uD55C \uCC28\uB97C \uB9C8\uC2DC\uB824\uBA74 \uC8FC\uBB38\uC744 \uC720\uC9C0\uD558\uC2E4 \uC218 \uC788\uC5B4\uC694.", friend: "\uC6B0\uB9AC \uAC19\uC774 \uB530\uB73B\uD55C \uCC28 \uB9C8\uC2DC\uB824\uACE0 \uD588\uC9C0?" }
      } }
    ],
    ending: { title: "\uAE4C\uBABD\uC758 \uCDE8\uD5A5\uC744 \uAE30\uC5B5\uD588\uC5B4\uC694.", text: "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794\uC744 \uBC1B\uC544 \uCE5C\uAD6C\uC640 \uD568\uAED8 \uC549\uC558\uC5B4\uC694.", orders: [order("tea", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794", "\uCE5C\uAD6C\uC640 \uD568\uAED8")], lines: [{ speaker: "kkamong", text: "\uC774 \uBAB8 \uCDE8\uD5A5\uC744 \uC798 \uC544\uB294\uAD70. \u2026\uB2E4\uC74C\uC5D0\uB3C4 \uAC19\uC774 \uC624\uC9C0." }, { speaker: "mongle", text: "\uC6B0\uC640! \uB2E4\uC74C\uC5D0\uB294 \uB0B4\uAC00 \uC88B\uC544\uD558\uB294 \uAC83\uB3C4 \uAC19\uC774 \uACE8\uB77C \uBCF4\uC790!" }, { speaker: "marine", text: "\uC218\uB839 \uC644\uB8CC. \uB530\uB73B\uD55C \uCC28, \uB450 \uC794. \u2026\uD3B8\uD788 \uC26C\uC5B4\uB77C." }] }
  },
  {
    id: "cafe-visit-soldout",
    number: 3,
    title: "\uC8FC\uC2A4\uAC00 \uC5C6\uB294 \uB0A0",
    caption: "\uC138 \uBC88\uC9F8 \uBC29\uBB38 \xB7 \uC791\uC740 \uD488\uC808 \uC548\uB0B4",
    description: "\uC8FC\uC2A4\uAC00 \uB2E4 \uB098\uAC04 \uB0A0. \uAC00\uB2A5\uD55C \uC74C\uB8CC\uB97C \uCC3E\uC544 \uACF5\uC6D0\uC5D0 \uAC00\uC838\uAC00\uC694.",
    steps: [
      { name: "\uC624\uB298\uC758 \uBA54\uB274", staff: "\uC624\uB298 \uC8FC\uC2A4\uB294 \uD488\uC808\uC774\uC5D0\uC694. \uB530\uB73B\uD55C \uCC28\uB294 \uC8FC\uBB38\uD558\uC2E4 \uC218 \uC788\uC5B4\uC694.", speaker: "mongle", friend: "\uC5B4? \uC8FC\uC2A4\uAC00 \uB2E4 \uB098\uAC14\uB124! \uAC19\uC774 \uB2E4\uB978 \uC74C\uB8CC\uB97C \uACE8\uB77C \uBCFC\uAE4C?", hint: "\uD488\uC808\uC740 \uC8FC\uBB38\uD560 \uC218 \uC5C6\uB2E4\uB294 \uB73B\uC774\uC5D0\uC694. \uC624\uB298 \uAC00\uB2A5\uD55C \uAC83\uC740 \uB530\uB73B\uD55C \uCC28\uC608\uC694.", next: "\uC218\uB7C9 \uB2E4\uC2DC \uD655\uC778\uD558\uAE30", menu: true, notice: "\uC624\uB298 \uC8FC\uC2A4 \uD488\uC808 \xB7 \uB530\uB73B\uD55C \uCC28 \uC8FC\uBB38 \uAC00\uB2A5", before: order(null, 0, "\uAC00\uB2A5\uD55C \uC74C\uB8CC\uB97C \uACE8\uB77C \uC8FC\uC138\uC694", "\uACF5\uC6D0\uC73C\uB85C \uAC00\uC838\uAC08 \uC8FC\uBB38"), options: {
        a: { ...order("tea", 1, "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794"), response: "\uB124, \uB530\uB73B\uD55C \uCC28 \uD55C \uC794\uC73C\uB85C \uC900\uBE44\uD560\uAC8C\uC694.", friend: "\uC624! \uCC28\uB294 \uC788\uAD6C\uB098! \uAC19\uC774 \uC8FC\uBB38\uC744 \uC774\uC5B4\uAC00\uC790!" },
        b: { ...order(null, 0, "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \xB7 \uD488\uC808", "\uC900\uBE44\uB418\uC9C0 \uC54A\uC740 \uC74C\uB8CC"), previewDrink: "cold", response: "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB3C4 \uC624\uB298\uC740 \uD488\uC808\uC774\uC5D0\uC694. \uB530\uB73B\uD55C \uCC28\uB294 \uC900\uBE44\uD560 \uC218 \uC788\uC5B4\uC694.", friend: "\uC5B4? \uC8FC\uC2A4\uB294 \uC624\uB298 \uC26C\uB294 \uB0A0\uC774\uB124! \uB2E4\uB978 \uBA54\uB274\uB97C \uAC19\uC774 \uBCF4\uC790!" },
        c: { ...order(null, 0, "\uB530\uB73B\uD55C \uC8FC\uC2A4 \xB7 \uD488\uC808", "\uC900\uBE44\uB418\uC9C0 \uC54A\uC740 \uC74C\uB8CC"), previewDrink: "warm", response: "\uB530\uB73B\uD55C \uC8FC\uC2A4\uB3C4 \uD488\uC808\uC774\uC5D0\uC694. \uC8FC\uC2A4 \uB300\uC2E0 \uB530\uB73B\uD55C \uCC28\uB85C \uB4DC\uB9B4\uAE4C\uC694?", friend: "\uC624! \uC628\uB3C4\uB97C \uBC14\uAFD4\uB3C4 \uC8FC\uC2A4\uB294 \uB2E4 \uB098\uAC14\uB124! \uCC28\uB97C \uAC19\uC774 \uBCF4\uC790!" }
      } },
      { name: "\uC9C1\uC6D0\uC758 \uC218\uB7C9 \uD655\uC778", staff: "\uB530\uB73B\uD55C \uCC28, \uB450 \uC794, \uB9DE\uC73C\uC2DC\uC8E0?", speaker: "marine", friend: "\uD544\uC694 \uC218\uB7C9, \uD55C \uC794. \uC8FC\uBB38 \uD655\uC778\uC744 \uACE0\uCE5C\uB2E4.", hint: "\uB450 \uC794\uC774 \uC544\uB2C8\uB77C \uD55C \uC794\uC774\uC5D0\uC694. \uC544\uB2C8\uC694, \uD55C \uC794 \uC8FC\uC138\uC694.", next: "\uACF5\uC6D0\uC5D0 \uAC00\uC838\uAC08 \uCEF5 \uBD80\uD0C1\uD558\uAE30", menu: true, before: order("tea", 1, "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794", "\uC218\uB7C9 \uD655\uC778 \uC911"), options: {
        a: { ...order("tea", 3, "\uB530\uB73B\uD55C \uCC28 \uC138 \uC794"), response: "\uC138 \uC794\uC73C\uB85C \uBC14\uAFC0\uAE4C\uC694? \uD63C\uC790 \uB4DC\uC2E4 \uD55C \uC794\uC774\uBA74 \uC218\uB7C9\uC744 \uB2E4\uC2DC \uC54C\uB824 \uC8FC\uC138\uC694.", friend: "\uD544\uC694\uD55C \uCEF5, \uD558\uB098. \uC218\uB7C9 \uC7AC\uD655\uC778." },
        b: { ...order("tea", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794"), response: "\uB450 \uC794\uC73C\uB85C \uD655\uC778\uD588\uC5B4\uC694. \uD55C \uC794\uB9CC \uD544\uC694\uD558\uBA74 \uBC14\uAFD4 \uB4DC\uB9B4\uAC8C\uC694.", friend: "\uBAA9\uD45C \uC218\uB7C9, \uD55C \uC794. \uD655\uC778\uC744 \uACE0\uCE5C\uB2E4." },
        c: { ...order("tea", 1, "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794"), response: "\uC544, \uD55C \uC794\uC774\uAD70\uC694. \uD55C \uC794\uC73C\uB85C \uD655\uC778\uD588\uC5B4\uC694. \uC5EC\uAE30\uC11C \uB4DC\uC2DC\uB098\uC694?", friend: "\uC218\uB7C9 \uD655\uC778 \uC644\uB8CC. \uD55C \uC794." }
      } },
      { name: "\uACF5\uC6D0\uC73C\uB85C \uAC00\uC838\uAC00\uAE30", staff: "\uCC28\uAC00 \uC900\uBE44\uB410\uC5B4\uC694. \uB9E4\uC7A5\uC5D0\uC11C \uB4DC\uC2DC\uB098\uC694?", speaker: "kkamong", friend: "\uC774 \uBAB8\uC774 \uACF5\uC6D0 \uBCA4\uCE58\uB3C4 \uBD10 \uB480\uC9C0. \uCC28\uB294 \uAC00\uC838\uAC00\uBA74 \uB418\uB294 \uAC70\uC57C.", hint: "\uACF5\uC6D0\uC73C\uB85C \uAC00\uC838\uAC00\uB824\uBA74 \uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", next: "\uD3EC\uC7A5\uD55C \uCC28 \uBC1B\uC544 \uACF5\uC6D0\uC73C\uB85C", before: order("tea", 1, "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794", "\uB9C8\uC2E4 \uACF3 \uD655\uC778 \uC911"), options: {
        a: { ...order("tea", 1, "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794"), response: "\uB9E4\uC7A5 \uCEF5\uC73C\uB85C \uB4DC\uB9B4\uAC8C\uC694. \uACF5\uC6D0\uC73C\uB85C \uAC00\uC838\uAC00\uC2DC\uBA74 \uD3EC\uC7A5 \uCEF5\uC774 \uD544\uC694\uD574\uC694.", friend: "\uB0B4\uAC00 \uBD10 \uB454 \uBCA4\uCE58\uB294 \uBC16\uC5D0 \uC788\uC9C0. \uAC00\uC838\uAC08 \uCEF5\uC73C\uB85C." },
        b: { ...order("takeout", 1, "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794", "\uD3EC\uC7A5 \xB7 \uACF5\uC6D0\uC73C\uB85C"), response: "\uB124, \uB69C\uAED1\uC744 \uB2EB\uC544 \uD3EC\uC7A5\uD588\uC5B4\uC694. \uCEF5\uC744 \uBC1B\uC544 \uAC00\uC138\uC694.", friend: "\uC774 \uBAB8 \uC900\uBE44\uB294 \uB05D\uB0AC\uC9C0. \u2026\uB530\uB73B\uD560 \uB54C \uAC00\uC790." },
        c: { ...order(null, 0, "\uCDE8\uC18C \uD655\uC778 \uC911", "\uC544\uC9C1 \uC218\uB839\uD558\uC9C0 \uC54A\uC74C"), response: "\uCDE8\uC18C\uD558\uC2DC\uACA0\uC5B4\uC694? \uACF5\uC6D0\uC5D0 \uAC00\uC838\uAC08 \uCC28\uB294 \uD3EC\uC7A5\uD574 \uB4DC\uB9B4 \uC218 \uC788\uC5B4\uC694.", friend: "\uCC28\uB294 \uC544\uC9C1 \uAC00\uC838\uAC08 \uAC70\uC9C0. \uD3EC\uC7A5\uC73C\uB85C \uBD80\uD0C1\uD558\uBA74 \uB3FC." }
      } }
    ],
    ending: { title: "\uC8FC\uC2A4 \uB300\uC2E0, \uC0C8\uB85C\uC6B4 \uD55C \uC794.", text: "\uD488\uC808 \uC548\uB0B4\uB97C \uC77D\uACE0 \uB530\uB73B\uD55C \uCC28 \uD55C \uC794\uC744 \uD3EC\uC7A5\uD574 \uBC1B\uC558\uC5B4\uC694.", orders: [order("takeout", 1, "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794", "\uACF5\uC6D0\uC73C\uB85C \uAC00\uC838\uAC00\uAE30")], lines: [{ speaker: "mongle", text: "\uC624! \uC624\uB298\uC740 \uCC28\uB97C \uB4E4\uACE0 \uAC19\uC774 \uACF5\uC6D0\uC5D0 \uAC00\uC790!" }, { speaker: "kkamong", text: "\uC774 \uBAB8\uC774 \uBD10 \uB454 \uBCA4\uCE58\uC57C. \u2026\uCEF5\uC740 \uCC9C\uCC9C\uD788 \uB0B4\uB824\uB194." }, { speaker: "marine", text: "\uB300\uCCB4 \uC8FC\uBB38, \uC218\uB839 \uC644\uB8CC. \u2026\uB2E4\uC74C\uC5D0\uB294 \uC8FC\uC2A4\uB3C4 \uB9CC\uB098\uACA0\uC9C0." }] }
  },
  {
    id: "cafe-visit-change",
    number: 4,
    title: "\uAE4C\uBABD\uC758 \uB9C8\uC74C\uC774 \uBC14\uB00C\uC5C8\uC5B4\uC694",
    caption: "\uB124 \uBC88\uC9F8 \uBC29\uBB38 \xB7 \uC8FC\uBB38 \uBC14\uAFB8\uAE30",
    description: "\uC74C\uB8CC\uB97C \uB9CC\uB4E4\uAE30 \uC804\uC774\uC5D0\uC694. \uCC28\uB85C \uBC14\uAFB8\uACE0 \uD55C \uC794 \uB354 \uCC59\uACA8 \uC138 \uCE5C\uAD6C\uAC00 \uACF5\uC6D0\uC5D0 \uAC00\uC694.",
    steps: [
      { name: "\uC74C\uB8CC \uBC14\uAFB8\uAE30", staff: "\uB530\uB73B\uD55C \uC8FC\uC2A4 \uB450 \uC794, \uC544\uC9C1 \uB9CC\uB4E4\uAE30 \uC804\uC774\uC5D0\uC694. \uC8FC\uBB38\uC744 \uBC14\uAFB8\uC2DC\uACA0\uC5B4\uC694?", speaker: "kkamong", friend: "\uC774 \uBAB8\uC740 \uB530\uB73B\uD55C \uCC28 \uCABD\uC774 \uB354 \uB04C\uB9AC\uB294\uAD70. \u2026\uC9C0\uAE08 \uBC14\uAFD4\uB3C4 \uB418\uACA0\uC9C0.", hint: "\uC8FC\uC2A4 \uB300\uC2E0 \uB530\uB73B\uD55C \uCC28\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694. \uBC14\uAFC0 \uC74C\uB8CC\uB97C \uD568\uAED8 \uB9D0\uD574\uC694.", next: "\uB9C8\uB9B0\uC758 \uCEF5 \uB354\uD558\uAE30", before: order("warm", 2, "\uB530\uB73B\uD55C \uC8FC\uC2A4 \uB450 \uC794", "\uBCC0\uACBD \uC804 \uC8FC\uBB38"), options: {
        a: { ...order("tea", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794"), response: "\uB124, \uC8FC\uC2A4 \uB300\uC2E0 \uB530\uB73B\uD55C \uCC28 \uB450 \uC794\uC73C\uB85C \uBC14\uAFE8\uC5B4\uC694.", friend: "\uB0B4\uAC00 \uCC3E\uB358 \uAC74 \uC774\uAC70\uC9C0. \uB530\uB73B\uD55C \uCC28." },
        b: { ...order("warm", 2, "\uB530\uB73B\uD55C \uC8FC\uC2A4 \uB450 \uC794"), response: "\uB530\uB73B\uD55C \uC8FC\uC2A4 \uB450 \uC794\uC744 \uC720\uC9C0\uD560\uAC8C\uC694. \uCC28\uB85C \uBC14\uAFB8\uB824\uBA74 \uB2E4\uC2DC \uC54C\uB824 \uC8FC\uC138\uC694.", friend: "\uC774 \uBAB8\uC740 \uC624\uB298 \uCC28\uB85C \uBC14\uAFB8\uACE0 \uC2F6\uAD70." },
        c: { ...order("cold", 2, "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uB450 \uC794"), response: "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB85C \uBC14\uAFC0\uAC8C\uC694. \uB530\uB73B\uD55C \uCC28\uB97C \uC6D0\uD558\uC2DC\uBA74 \uC885\uB958\uB3C4 \uD568\uAED8 \uC54C\uB824 \uC8FC\uC138\uC694.", friend: "\uB0B4\uAC00 \uC6D0\uD558\uB294 \uAC74 \uB530\uB73B\uD55C \uCC28\uC57C. \uC8FC\uC2A4 \uB9D0\uACE0." }
      } },
      { name: "\uD55C \uC794 \uB354", staff: "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794\uC73C\uB85C \uBC14\uAFE8\uC5B4\uC694. \uB354 \uD544\uC694\uD55C \uAC83\uC774 \uC788\uB098\uC694?", speaker: "mongle", friend: "\uC624! \uB9C8\uB9B0\uB3C4 \uAC19\uC774 \uB9C8\uC2E0\uB300! \uB450 \uC794\uC5D0 \uD55C \uC794 \uB354\uD558\uBA74 \uC14B\uC774\uC57C!", hint: "\uB450 \uC794\uC5D0 \uD55C \uC794\uC744 \uCD94\uAC00\uD574\uC694. \uD55C \uC794 \uB354 \uC8FC\uC138\uC694.", next: "\uAC00\uC838\uAC08 \uACF3 \uBC14\uAFB8\uAE30", menu: true, before: order("tea", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794", "\uCD94\uAC00 \uC804 \uC8FC\uBB38"), options: {
        a: { ...order("tea", 1, "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794"), response: "\uD55C \uC794\uC744 \uBE7C\uBA74 \uD55C \uC794\uB9CC \uB0A8\uC544\uC694. \uC138 \uC794\uC774 \uD544\uC694\uD558\uC2DC\uBA74 \uD55C \uC794 \uB354 \uCD94\uAC00\uD560\uAE4C\uC694?", friend: "\uC5B4? \uCEF5\uC774 \uC904\uC5C8\uB124! \uC6B0\uB9AC\uB294 \uC14B\uC774 \uAC19\uC774 \uB9C8\uC154\uC57C \uD574!" },
        b: { ...order("tea", 3, "\uB530\uB73B\uD55C \uCC28 \uC138 \uC794"), response: "\uD55C \uC794 \uCD94\uAC00\uD574\uC11C \uB530\uB73B\uD55C \uCC28 \uC138 \uC794\uC73C\uB85C \uC900\uBE44\uD560\uAC8C\uC694.", friend: "\uC6B0\uC640! \uCEF5\uC774 \uC14B\uC774\uC57C! \uB9C8\uB9B0 \uAC83\uB3C4 \uC0DD\uACBC\uB124!" },
        c: { ...order("tea", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794"), response: "\uB450 \uC794\uC744 \uC720\uC9C0\uD560\uAC8C\uC694. \uC138 \uBD84\uC774 \uB4DC\uC2DC\uBA74 \uD55C \uC794 \uB354 \uCD94\uAC00\uD560 \uC218 \uC788\uC5B4\uC694.", friend: "\uB9C8\uB9B0 \uCEF5\uB3C4 \uAC19\uC774 \uCC59\uAE30\uC790! \uD55C \uC794 \uB354 \uD544\uC694\uD574!" }
      } },
      { name: "\uD3EC\uC7A5\uC73C\uB85C \uBCC0\uACBD", staff: "\uC138 \uC794 \uBAA8\uB450 \uB9E4\uC7A5\uC5D0\uC11C \uB4DC\uC2E4 \uAC74\uAC00\uC694?", speaker: "marine", friend: "\uBAA9\uC801\uC9C0 \uBCC0\uACBD. \uCE74\uD398\uC5D0\uC11C \uACF5\uC6D0\uC73C\uB85C. \uD3EC\uC7A5 \uCEF5, \uC14B.", hint: "\uC8FC\uBB38\uC740 \uC720\uC9C0\uD558\uACE0 \uB9C8\uC2E4 \uACF3\uC744 \uBC14\uAFD4\uC694. \uD3EC\uC7A5\uC73C\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694.", next: "\uC138 \uCE5C\uAD6C\uC758 \uCEF5 \uBC1B\uC544 \uCD9C\uBC1C\uD558\uAE30", before: order("tea", 3, "\uB530\uB73B\uD55C \uCC28 \uC138 \uC794", "\uB9E4\uC7A5 \uC774\uC6A9"), options: {
        a: { ...order("tea", 3, "\uB530\uB73B\uD55C \uCC28 \uC138 \uC794"), response: "\uB9E4\uC7A5 \uCEF5 \uC138 \uC794\uC73C\uB85C \uB4DC\uB9B4\uAC8C\uC694. \uACF5\uC6D0\uC5D0 \uAC00\uC838\uAC00\uC2E4 \uAC70\uBA74 \uD3EC\uC7A5\uC73C\uB85C \uBC14\uAFC0 \uC218 \uC788\uC5B4\uC694.", friend: "\uBAA9\uC801\uC9C0, \uACF5\uC6D0. \uAC00\uC838\uAC08 \uD3EC\uC7A5 \uCEF5\uC774 \uD544\uC694\uD558\uB2E4." },
        b: { ...order(null, 0, "\uCDE8\uC18C \uD655\uC778 \uC911", "\uC544\uC9C1 \uC218\uB839\uD558\uC9C0 \uC54A\uC74C"), response: "\uC138 \uC794 \uBAA8\uB450 \uCDE8\uC18C\uD558\uC2DC\uACA0\uC5B4\uC694? \uC74C\uB8CC\uB294 \uC720\uC9C0\uD558\uACE0 \uD3EC\uC7A5\uB9CC \uBC14\uAFC0 \uC218 \uC788\uC5B4\uC694.", friend: "\uC74C\uB8CC \uC720\uC9C0. \uB9C8\uC2E4 \uC7A5\uC18C\uB9CC \uBCC0\uACBD\uD55C\uB2E4." },
        c: { ...order("takeout", 3, "\uB530\uB73B\uD55C \uCC28 \uC138 \uC794", "\uD3EC\uC7A5 \xB7 \uACF5\uC6D0\uC73C\uB85C"), response: "\uB124, \uC138 \uC794 \uBAA8\uB450 \uD3EC\uC7A5\uC73C\uB85C \uBC14\uAFE8\uC5B4\uC694. \uCEF5\uC744 \uBC1B\uC544 \uAC00\uC138\uC694.", friend: "\uBCC0\uACBD \uD655\uC778 \uC644\uB8CC. \u2026\uB124 \uCEF5\uB3C4 \uCC59\uACA8\uB77C." }
      } }
    ],
    ending: { title: "\uC14B\uC758 \uCEF5\uC744 \uBAA8\uB450 \uCC59\uACBC\uC5B4\uC694.", text: "\uC8FC\uC2A4\uB97C \uB530\uB73B\uD55C \uCC28\uB85C \uBC14\uAFB8\uACE0, \uD55C \uC794\uC744 \uB354\uD574 \uC138 \uC794\uC744 \uD3EC\uC7A5\uD574 \uBC1B\uC558\uC5B4\uC694.", orders: [order("takeout", 3, "\uB530\uB73B\uD55C \uCC28 \uC138 \uC794", "\uC138 \uCE5C\uAD6C\uC640 \uACF5\uC6D0\uC73C\uB85C")], lines: [{ speaker: "kkamong", text: "\uC774 \uBAB8 \uC8FC\uBB38\uB3C4 \uC644\uBCBD\u2026 \uD574\uC84C\uAD70. \uAC19\uC774 \uACE8\uB77C \uC918\uC11C." }, { speaker: "mongle", text: "\uC6B0\uC640! \uC6B0\uB9AC \uCEF5\uC774 \uB2E4 \uC788\uC5B4! \uAC19\uC774 \uCD9C\uBC1C\uD558\uC790!" }, { speaker: "marine", text: "\uC218\uB839 \uC644\uB8CC. \uC804\uC6D0, \uC138 \uCEF5. \u2026\uC774\uBC88\uC5D0\uB294 \uB0B4 \uCEF5\uB3C4 \uC788\uB2E4." }] }
  },
  {
    id: CAFE_COMPOSE_ID,
    number: 5,
    title: "\uB0B4 \uB9D0\uB85C \uC8FC\uBB38\uD574\uC694",
    caption: "\uB2E4\uC12F \uBC88\uC9F8 \uBC29\uBB38 \xB7 \uC9C1\uC811 \uB9CC\uB4DC\uB294 \uC8FC\uBB38",
    description: "\uC74C\uB8CC\xB7\uC628\uB3C4\xB7\uC794 \uC218\uB97C \uACE8\uB77C \uB098\uC758 \uC8FC\uBB38 \uBB38\uC7A5\uC744 \uB9CC\uB4E4\uACE0 \uCE5C\uAD6C\uC640 \uC26C\uC5B4\uC694.",
    seatStep: 2,
    steps: [
      { name: "\uB0B4 \uC8FC\uBB38 \uB9CC\uB4E4\uAE30", staff: "\uC5B4\uC11C \uC624\uC138\uC694. \uC5B4\uB5A4 \uC74C\uB8CC\uB97C \uBA87 \uC794 \uC900\uBE44\uD560\uAE4C\uC694?", speaker: "mongle", friend: "\uC624! \uAE4C\uBABD\uACFC \uD55C \uC794\uC529, \uB530\uB73B\uD55C \uCC28 \uB450 \uC794\uC744 \uAC19\uC774 \uB9CC\uB4E4\uC5B4 \uBCF4\uC790!", hint: "\uCC28\uB97C \uACE0\uB974\uACE0, \uB530\uB73B\uD558\uAC8C, \uB450 \uC794\uC744 \uACE8\uB77C\uC694. \uC138 \uC815\uBCF4\uB97C \uD569\uCCD0 \uC8FC\uBB38\uD574\uC694.", next: "\uC9C1\uC6D0\uACFC \uC218\uB7C9 \uD655\uC778\uD558\uAE30", compose: true, options: {} },
      { name: "\uC218\uB7C9 \uD655\uC778", staff: "\uB530\uB73B\uD55C \uCC28, \uB450 \uC794, \uB9DE\uC73C\uC2DC\uC8E0?", speaker: "marine", friend: "\uC8FC\uBB38 \uC815\uBCF4 \uD655\uC778. \uB530\uB73B\uD55C \uCC28, \uB450 \uC794.", hint: "\uC6D0\uD558\uB294 \uC218\uB7C9\uB3C4 \uB450 \uC794, \uC9C1\uC6D0\uC758 \uD655\uC778\uB3C4 \uB450 \uC794\uC774\uC5D0\uC694. \uB124, \uB450 \uC794 \uC8FC\uC138\uC694.", next: "\uB9C8\uC2E4 \uACF3 \uC54C\uB824 \uC8FC\uAE30", menu: true, before: order("tea", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794", "\uC218\uB7C9 \uD655\uC778 \uC911"), options: {
        a: { ...order("tea", 1, "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794"), response: "\uD55C \uC794\uC73C\uB85C \uBC14\uAFC0\uAE4C\uC694? \uB450 \uBD84\uC774 \uD55C \uC794\uC529 \uB4DC\uC2DC\uBA74 \uB450 \uC794\uC774 \uD544\uC694\uD574\uC694.", friend: "\uD544\uC694 \uC218\uB7C9 \uC7AC\uD655\uC778. \uB450 \uC0AC\uB78C\uC758 \uCEF5, \uB458." },
        b: { ...order("tea", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794"), response: "\uB124, \uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uD655\uC778\uD588\uC5B4\uC694.", friend: "\uC218\uB7C9 \uD655\uC778 \uC644\uB8CC. \uB450 \uC794." },
        c: { ...order("tea", 3, "\uB530\uB73B\uD55C \uCC28 \uC138 \uC794"), response: "\uC138 \uC794\uC73C\uB85C \uBC14\uAFC0\uAE4C\uC694? \uB450 \uBD84\uC758 \uCEF5\uB9CC \uD544\uC694\uD558\uBA74 \uB450 \uC794\uC744 \uC720\uC9C0\uD560 \uC218 \uC788\uC5B4\uC694.", friend: "\uC8FC\uBB38 \uB300\uC0C1, \uB450 \uC0AC\uB78C. \uD544\uC694\uD55C \uCEF5, \uB458." }
      } },
      { name: "\uC6B0\uB9AC \uC790\uB9AC", staff: "\uAC00\uC838\uAC00\uC2E4 \uAC74\uAC00\uC694, \uC5EC\uAE30\uC11C \uB4DC\uC2E4 \uAC74\uAC00\uC694?", speaker: "kkamong", friend: "\uC774 \uBAB8\uC774\uB791 \uC5EC\uAE30\uC11C \uC26C\uC5B4 \uAC00\uC790. \u2026\uB530\uB73B\uD560 \uB54C.", hint: "\uCE74\uD398 \uC548\uC5D0\uC11C \uD568\uAED8 \uB9C8\uC2DC\uB824\uBA74 \uB124, \uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", next: "\uB0B4\uAC00 \uC8FC\uBB38\uD55C \uCC28 \uBC1B\uC544 \uC549\uAE30", before: order("tea", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794", "\uB9C8\uC2E4 \uACF3 \uD655\uC778 \uC911"), options: {
        a: { ...order("tea", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794"), response: "\uB124, \uB450 \uC794 \uBAA8\uB450 \uB9E4\uC7A5 \uCEF5\uC5D0 \uC900\uBE44\uD588\uC5B4\uC694. \uC790\uB9AC\uB97C \uACE8\uB77C \uBC1B\uC544 \uAC00\uC138\uC694.", friend: "\uB0B4 \uCEF5\uB3C4 \uC788\uAD70. \u2026\uAC19\uC774 \uC549\uC544." },
        b: { ...order("takeout", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794", "\uD3EC\uC7A5 \uC694\uCCAD"), response: "\uD3EC\uC7A5\uC73C\uB85C \uC900\uBE44\uD560\uAC8C\uC694. \uCE74\uD398 \uC548\uC5D0\uC11C \uC26C\uC2E4 \uAC70\uBA74 \uB9E4\uC7A5 \uC774\uC6A9\uC73C\uB85C \uBC14\uAFC0\uAE4C\uC694?", friend: "\uC774 \uBAB8\uC740 \uC5EC\uAE30\uC11C \uC26C\uB824\uACE0 \uD588\uC9C0. \uB9E4\uC7A5 \uCEF5\uC73C\uB85C." },
        c: { ...order(null, 0, "\uCDE8\uC18C \uD655\uC778 \uC911", "\uC544\uC9C1 \uC218\uB839\uD558\uC9C0 \uC54A\uC74C"), response: "\uCDE8\uC18C\uD558\uC2DC\uACA0\uC5B4\uC694? \uC74C\uB8CC\uB97C \uD568\uAED8 \uB9C8\uC2DC\uB824\uBA74 \uC8FC\uBB38\uC744 \uC720\uC9C0\uD558\uC2E4 \uC218 \uC788\uC5B4\uC694.", friend: "\uB0B4 \uCEF5\uC740 \uC544\uC9C1 \uD544\uC694\uD558\uC9C0. \u2026\uB124 \uCEF5\uB3C4." }
      } }
    ],
    ending: { title: "\uB2E8\uC5B4\uAC00 \uB098\uC758 \uC8FC\uBB38\uC774 \uB410\uC5B4\uC694.", text: "\uC74C\uB8CC\xB7\uC628\uB3C4\xB7\uC218\uB7C9\uC744 \uC9C1\uC811 \uACE8\uB77C \uB530\uB73B\uD55C \uCC28 \uB450 \uC794\uC744 \uC8FC\uBB38\uD558\uACE0 \uCE5C\uAD6C\uC640 \uC549\uC558\uC5B4\uC694.", orders: [order("tea", 2, "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794", "\uB098\uC758 \uC8FC\uBB38")], lines: [{ speaker: "mongle", text: "\uC6B0\uC640! \uB124\uAC00 \uB9CC\uB4E0 \uBB38\uC7A5\uC774 \uC9C4\uC9DC \uCEF5\uC774 \uB410\uC5B4! \uAC19\uC774 \uB9C8\uC2DC\uC790!" }, { speaker: "kkamong", text: "\uC774 \uBAB8 \uCDE8\uD5A5\uB3C4, \uB124 \uCEF5\uB3C4 \uC798 \uCC59\uACBC\uAD70. \u2026\uB2E4\uC74C \uC8FC\uBB38\uB3C4 \uBD80\uD0C1\uD558\uC9C0." }, { speaker: "marine", text: "\uC8FC\uBB38 \uAD6C\uC131, \uC218\uB839 \uC644\uB8CC. \u2026\uB124 \uB9D0\uB85C \uD574\uB0C8\uB2E4." }] }
  }
];
var CAFE_LESSON_IDS = CAFE_VISITS.map((visit) => visit.id);
var cafeVisitById = (id) => CAFE_VISITS.find((visit) => visit.id === id) || null;
var isCafeLesson = (id) => CAFE_LESSON_IDS.includes(id);
function isCafeOrder(value, { complete = false } = {}) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 3 && Object.keys(value).every((k) => ["drink", "temperature", "count"].includes(k)) && (complete ? ["juice", "tea"] : [null, "juice", "tea"]).includes(value.drink) && (complete ? ["cold", "warm"] : [null, "cold", "warm"]).includes(value.temperature) && (complete ? [1, 2, 3] : [null, 1, 2, 3]).includes(value.count);
}
var isCafeListen = (value) => !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 3 && Object.keys(value).every((k) => ["mode", "heard", "textShown"].includes(k)) && ["listen", "read"].includes(value.mode) && typeof value.heard === "boolean" && typeof value.textShown === "boolean";
function cafeOrderText(value) {
  return isCafeOrder(value, { complete: true }) ? `${value.temperature === "warm" ? "\uB530\uB73B\uD55C" : "\uCC28\uAC00\uC6B4"} ${value.drink === "tea" ? "\uCC28" : "\uC8FC\uC2A4"} ${["", "\uD55C", "\uB450", "\uC138"][value.count]} \uC794 \uC8FC\uC138\uC694.` : "\uC74C\uB8CC \xB7 \uC628\uB3C4 \xB7 \uC794 \uC218\uB97C \uACE8\uB77C \uC8FC\uC138\uC694.";
}
var orderChoice = (value) => value.drink !== "tea" || value.temperature !== "warm" ? "c" : value.count !== 2 ? "b" : "a";
function updateCafeOrder(state, field, value) {
  check(state, CAFE_COMPOSE_ID);
  if (state.step !== 0 || !["choose", "repair"].includes(state.phase)) throw TypeError("\uC8FC\uBB38\uC744 \uB9CC\uB4DC\uB294 \uB2E8\uACC4\uC5D0\uC11C \uACE8\uB77C \uC8FC\uC138\uC694.");
  const order2 = { ...state.order, [field]: value };
  if (!isCafeOrder(order2)) throw TypeError("\uC74C\uB8CC, \uC628\uB3C4, \uC794 \uC218\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
  return { ...state, order: order2, phase: "choose", choiceId: null };
}
function submitCafeOrder(state) {
  check(state, CAFE_COMPOSE_ID);
  if (state.step !== 0 || !["choose", "repair"].includes(state.phase) || !isCafeOrder(state.order, { complete: true })) throw TypeError("\uC74C\uB8CC\xB7\uC628\uB3C4\xB7\uC794 \uC218\uB97C \uBAA8\uB450 \uACE8\uB77C \uC8FC\uC138\uC694.");
  const choiceId = orderChoice(state.order);
  return { ...state, choiceId, phase: choiceId === "a" ? "response" : "repair" };
}
function isCafeCheckpoint(value, lessonId = CAFE_LESSON_ID) {
  const visit = cafeVisitById(lessonId);
  if (!visit) return false;
  if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== (lessonId === CAFE_COMPOSE_ID ? 2 : 1) || !Number.isInteger(value.step) || value.step < 0 || value.step > 3 || !phases.includes(value.phase) || !Object.hasOwn(CAFE_SEATS, value.seat) || ![null, "a", "b", "c"].includes(value.choiceId)) return false;
  if (Object.keys(value).some((key) => !["version", "step", "phase", "seat", "choiceId", "listen", ...lessonId === CAFE_COMPOSE_ID ? ["order"] : []].includes(key))) return false;
  if (value.listen !== void 0 && !isCafeListen(value.listen)) return false;
  if (lessonId === CAFE_COMPOSE_ID && (!isCafeOrder(value.order) || value.step > 0 && !isCafeOrder(value.order, { complete: true }))) return false;
  if (value.phase === "welcome") return value.step === 0 && value.choiceId === null;
  if (value.phase === "break") return value.step === visit.breakStep && value.choiceId === null;
  if (value.phase === "complete") return value.step === 3 && value.choiceId === null;
  if (value.step > 2) return false;
  if (value.phase === "choose") return value.choiceId === null;
  if (lessonId === CAFE_COMPOSE_ID && value.step === 0 && (!isCafeOrder(value.order, { complete: true }) || value.choiceId !== orderChoice(value.order))) return false;
  const answer = cafeQuestion(value.step, lessonId)?.answerId;
  return !!answer && value.choiceId !== null && (value.phase === "response" ? value.choiceId === answer : value.choiceId !== answer);
}
var check = (state, id) => {
  if (!isCafeCheckpoint(state, id)) throw TypeError("Invalid cafe checkpoint");
};
function cafeQuestion(step, lessonId = CAFE_LESSON_ID) {
  return lessonById(lessonId)?.questions[step] || null;
}
function resumeCafe(state, lessonId = state.id || CAFE_LESSON_ID) {
  if (!isCafeLesson(lessonId)) throw TypeError("Unknown cafe visit");
  if (isCafeCheckpoint(state.stage?.cafe, lessonId)) return clone(state.stage.cafe);
  const result = { version: lessonId === CAFE_COMPOSE_ID ? 2 : 1, step: 0, phase: "welcome", choiceId: null, seat: "window", ...lessonId === CAFE_COMPOSE_ID ? { order: { drink: null, temperature: null, count: null } } : {} };
  const questions = lessonById(lessonId).questions;
  const firstWrong = questions.findIndex((q) => state.answers[q.id] && !state.answers[q.id].correct);
  const lastAnswered = questions.reduce((last, q, index2) => state.answers[q.id] ? index2 : last, -1);
  const index = firstWrong < 0 ? lastAnswered : firstWrong;
  if (index >= 0) {
    const q = questions[index], answer = state.answers[q.id];
    result.step = index;
    result.choiceId = q.choices.some((c) => c.id === answer.choiceId) ? answer.choiceId : q.answerId;
    result.phase = result.choiceId === q.answerId ? "response" : "repair";
  }
  return result;
}
function chooseCafe(state, choiceId, lessonId = CAFE_LESSON_ID) {
  if (lessonId === CAFE_COMPOSE_ID && state.step === 0) throw TypeError("\uB2E8\uC5B4\uB97C \uACE8\uB77C \uC8FC\uBB38 \uBB38\uC7A5\uC744 \uB9CC\uB4E4\uC5B4 \uC8FC\uC138\uC694.");
  check(state, lessonId);
  if (!["choose", "repair"].includes(state.phase) || !Object.hasOwn(cafeVisitById(lessonId).steps[state.step].options, choiceId)) throw TypeError("Cafe is not accepting an order");
  return { ...state, choiceId, phase: choiceId === cafeQuestion(state.step, lessonId).answerId ? "response" : "repair" };
}
function advanceCafe(state, lessonId = CAFE_LESSON_ID) {
  check(state, lessonId);
  const listen = state.listen ? { listen: { ...state.listen, heard: false, textShown: false } } : {};
  if (state.phase === "welcome" || state.phase === "break") return { ...state, ...listen, phase: "choose", choiceId: null };
  if (state.phase !== "response") throw TypeError("Confirm the cafe request first");
  const step = state.step + 1;
  return { ...state, ...listen, step, phase: step === cafeVisitById(lessonId).breakStep ? "break" : step === 3 ? "complete" : "choose", choiceId: null };
}
function chooseCafeSeat(state, seat, lessonId = CAFE_LESSON_ID) {
  check(state, lessonId);
  if (!Object.hasOwn(CAFE_SEATS, seat) || !(state.step === cafeVisitById(lessonId).seatStep && state.phase === "response" || state.phase === "break")) throw TypeError("Choose a seat after ordering");
  return { ...state, seat };
}
function cafeReceipt(state, lessonId = CAFE_LESSON_ID) {
  check(state, lessonId);
  if (lessonId !== CAFE_LESSON_ID) {
    const visit = cafeVisitById(lessonId);
    if (state.phase === "complete") return { ...visit.ending.orders[0], place: visit.seatStep === 2 ? CAFE_SEATS[state.seat] : visit.ending.orders[0].place, received: true };
    if (lessonId === CAFE_COMPOSE_ID && state.step === 0) {
      const selected = isCafeOrder(state.order, { complete: true });
      return { drink: selected ? state.order.drink === "tea" ? state.order.temperature === "cold" ? "coldtea" : "tea" : state.order.temperature === "cold" ? "cold" : "warm" : null, count: selected ? state.order.count : 0, label: cafeOrderText(state.order), place: state.choiceId ? "\uC9C1\uC6D0\uACFC \uC8FC\uBB38 \uD655\uC778 \uC911" : "\uC544\uC9C1 \uBCF4\uB0B4\uC9C0 \uC54A\uC740 \uC8FC\uBB38", received: false };
    }
    const step = visit.steps[state.step], selection2 = state.choiceId ? step.options[state.choiceId] : null;
    const result = { ...selection2 || step.before, received: false };
    if (state.phase === "response" && state.step === visit.seatStep) result.place = CAFE_SEATS[state.seat];
    return { drink: result.drink, count: result.count, label: result.label, place: result.place, received: false };
  }
  if (state.phase === "complete") return { drink: "takeout", count: 1, label: "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794", place: "\uD3EC\uC7A5 \xB7 \uD559\uAD50\uB85C", received: true };
  if (state.phase === "break") return { drink: "cold", count: 2, label: "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uB450 \uC794", place: CAFE_SEATS[state.seat], received: true };
  const selection = state.choiceId ? CAFE_STEPS[state.step].options[state.choiceId] : null;
  if (state.step === 0) return { drink: selection?.drink || null, count: selection?.count || 0, label: selection?.label || "\uC74C\uB8CC\uB97C \uACE8\uB77C \uC8FC\uC138\uC694", place: "\uB9C8\uC2E4 \uACF3\uC740 \uC544\uC9C1", received: false };
  if (state.step === 1) return { drink: "cold", count: 2, label: "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uB450 \uC794", place: state.choiceId === "a" ? "\uD3EC\uC7A5 \uC694\uCCAD" : state.choiceId === "c" ? CAFE_SEATS[state.seat] : "\uB9C8\uC2E4 \uACF3 \uD655\uC778 \uC911", received: false };
  return { drink: selection ? selection.drink : "tea", count: selection ? selection.count : 1, label: state.choiceId === "c" ? "\uCDE8\uC18C \uD655\uC778 \uC911" : "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794", place: state.choiceId === "a" ? "\uD3EC\uC7A5 \xB7 \uD559\uAD50\uB85C" : state.choiceId === "b" ? "\uB9E4\uC7A5 \uC774\uC6A9" : "\uD3EC\uC7A5 \uC5EC\uBD80 \uD655\uC778 \uC911", received: false };
}

// experiences/synk-world-app/life-progress.mjs
var LIFE_PROGRESS_KEY = "synk.life-korean.progress.v1";
var LIFE_PROGRESS_VERSION = 1;
var MINUTE = 6e4;
var DAY = 864e5;
var INTERVALS = [1, 3, 7, 14, 30];
var clone2 = (value) => JSON.parse(JSON.stringify(value));
var fail = (code, message) => Object.assign(new Error(message || code), { code });
var safeId = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,119}$/i.test(value);
var object = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
var time = (value) => Number.isSafeInteger(value) && value >= 0;
var empty = (owner) => ({ version: LIFE_PROGRESS_VERSION, owner, revision: 0, activeLessonId: null, activeReview: null, lessons: {}, reviews: {} });
var TUTORS = /* @__PURE__ */ new Set(["marin", "kkamong", "mongle"]);
var OUTCOMES = /* @__PURE__ */ new Set(["independent", "assisted", "retry"]);
var dailyId = (value) => safeId(value) && !["constructor", "prototype"].includes(value);
var DAILY_MAX_TIME = 253402268399999;
var dailyTime = (value) => time(value) && value <= DAILY_MAX_TIME;
function lifeDayKey(at) {
  if (!dailyTime(at)) throw TypeError("Invalid learning time");
  return new Date(at + 9 * 36e5).toISOString().slice(0, 10);
}
var dailyLatest = (item) => Math.max(item.observedAt ?? 0, item.guidedAt ?? 0);
function trimDaily(daily) {
  const keys = Object.keys(daily.days).sort();
  for (const key of keys.slice(0, -30)) delete daily.days[key];
  for (const day of Object.values(daily.days)) {
    const ids = Object.keys(day.items).sort((a, b) => dailyLatest(day.items[b]) - dailyLatest(day.items[a]) || (a < b ? -1 : a > b ? 1 : 0));
    for (const id of ids.slice(100)) delete day.items[id];
  }
}
function fitDailyRecord(value) {
  if (!value.daily) return;
  const bytes = () => new TextEncoder().encode(JSON.stringify(value)).length;
  while (bytes() > 48e4) {
    const oldest = Object.keys(value.daily.days).sort()[0];
    if (!oldest) break;
    delete value.daily.days[oldest];
  }
}
function validateDaily(daily) {
  const invalid = () => {
    throw fail("LIFE_PROGRESS_UNREADABLE");
  };
  if (!object(daily) || daily.version !== 1 || !object(daily.days) || Object.keys(daily).some((key) => !["version", "days"].includes(key)) || Object.keys(daily.days).length > 30) invalid();
  for (const [key, day] of Object.entries(daily.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !object(day) || Object.keys(day).some((key2) => !["items", "closedAt"].includes(key2)) || !object(day.items) || !Object.keys(day.items).length || Object.keys(day.items).length > 100) invalid();
    const sameDay = (at) => dailyTime(at) && lifeDayKey(at) === key;
    if (day.closedAt !== void 0 && !sameDay(day.closedAt)) invalid();
    for (const [id, item] of Object.entries(day.items)) {
      if (!dailyId(id) || !object(item) || Object.keys(item).some((key2) => !["lessonId", "observedAt", "outcome", "guidedAt", "tutorId"].includes(key2)) || !dailyId(item.lessonId)) invalid();
      if (item.observedAt === void 0 ? item.outcome !== void 0 : item.outcome === void 0 || !sameDay(item.observedAt) || !OUTCOMES.has(item.outcome)) invalid();
      if (item.guidedAt === void 0 ? item.tutorId !== void 0 : !sameDay(item.guidedAt) || !TUTORS.has(item.tutorId)) invalid();
      if (item.observedAt === void 0 && item.guidedAt === void 0) invalid();
    }
  }
}
function dailyObservation(next, { questionId, lessonId, at, correct, helped }, migrating = false) {
  if (!dailyTime(at) || !dailyId(questionId) || !dailyId(lessonId)) return;
  const dayKey = lifeDayKey(at), daily = next.daily ??= { version: 1, days: {} }, day = daily.days[dayKey] ??= { items: {} }, old = day.items[questionId];
  if (migrating && old?.observedAt >= at) return;
  const observedAt = migrating ? at : dailyEventTime(day, old, at);
  day.items[questionId] = { ...old, lessonId, observedAt, outcome: correct ? helped ? "assisted" : "independent" : "retry" };
  trimDaily(daily);
}
function dailyEventTime(day, item, at) {
  const end = Date.parse(lifeDayKey(at) + "T23:59:59.999+09:00");
  const value = Math.min(end, Math.max(at, dailyLatest(item || {}) + 1, (day.closedAt ?? -1) + 1));
  if (day.closedAt !== void 0 && value <= day.closedAt) delete day.closedAt;
  return value;
}
function backfillDaily(value) {
  if (value.daily !== void 0) return;
  for (const [lessonId, lesson2] of Object.entries(value.lessons)) for (const [questionId, answer] of Object.entries(lesson2.answers)) dailyObservation(value, { lessonId, questionId, ...answer }, true);
  for (const [reviewId, answer] of Object.entries(value.activeReview?.answers || {})) {
    const review = value.reviews[reviewId];
    if (review) dailyObservation(value, { lessonId: review.lessonId, questionId: review.questionId, ...answer }, true);
  }
  fitDailyRecord(value);
}
function validate(raw, owner) {
  if (typeof raw !== "string" || raw.length > 5e5) throw fail("LIFE_PROGRESS_UNREADABLE");
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw fail("LIFE_PROGRESS_UNREADABLE");
  }
  if (!object(value) || value.version !== 1 || value.owner !== owner || !time(value.revision) || !object(value.lessons) || !object(value.reviews) || Object.keys(value.lessons).length > 100 || Object.keys(value.reviews).length > 400) throw fail("LIFE_PROGRESS_UNREADABLE");
  if (value.activeLessonId !== null && !safeId(value.activeLessonId)) throw fail("LIFE_PROGRESS_UNREADABLE");
  for (const [id, lesson2] of Object.entries(value.lessons)) {
    if (!safeId(id) || !object(lesson2) || !safeId(lesson2.attemptId) || !time(lesson2.startedAt) || lesson2.completedAt !== null && !time(lesson2.completedAt) || !object(lesson2.answers) || Object.keys(lesson2.answers).length > 100 || !Array.isArray(lesson2.questionIds) || lesson2.questionIds.length > 100 || !lesson2.questionIds.every(safeId) || new Set(lesson2.questionIds).size !== lesson2.questionIds.length) throw fail("LIFE_PROGRESS_UNREADABLE");
    if (lesson2.questionIds.some((id2) => !safeId(id2)) || Object.keys(lesson2.answers).some((id2) => !lesson2.questionIds.includes(id2))) throw fail("LIFE_PROGRESS_UNREADABLE");
    for (const [qid, answer] of Object.entries(lesson2.answers)) if (!object(answer) || typeof answer.correct !== "boolean" || typeof answer.helped !== "boolean" || !time(answer.at) || answer.choiceId !== null && !safeId(answer.choiceId) || answer.order !== void 0 && (id !== CAFE_COMPOSE_ID || qid !== "cafe-compose-order" || !isCafeOrder(answer.order, { complete: true })) || answer.input !== void 0 && (!isCafeLesson(id) || !isCafeListen(answer.input))) throw fail("LIFE_PROGRESS_UNREADABLE");
    if (lesson2.stage !== void 0 && (!object(lesson2.stage) || !["intro", "story", "questions"].includes(lesson2.stage.phase) || !time(lesson2.stage.sceneIndex) || !time(lesson2.stage.questionIndex) || lesson2.stage.sceneIndex > 100 || lesson2.stage.questionIndex > 100 || lesson2.stage.helped !== void 0 && typeof lesson2.stage.helped !== "boolean")) throw fail("LIFE_PROGRESS_UNREADABLE");
    if (lesson2.stage?.cafe !== void 0 && (!isCafeLesson(id) || lesson2.stage.phase !== "questions" || !isCafeCheckpoint(lesson2.stage.cafe, id) || lesson2.stage.questionIndex !== lesson2.stage.cafe.step || lesson2.stage.sceneIndex !== lesson2.stage.cafe.step || lesson2.stage.cafe.phase === "complete" && lesson2.questionIds.some((qid) => !lesson2.answers[qid]))) throw fail("LIFE_PROGRESS_UNREADABLE");
  }
  for (const [id, review] of Object.entries(value.reviews)) {
    if (!safeId(id) || !object(review) || review.id !== id || !safeId(review.questionId) || !safeId(review.lessonId) || !safeId(review.packId) || !safeId(review.skillId) || !time(review.dueAt) || !time(review.lastAt) || !time(review.streak) || review.streak > 1e3 || !time(review.lapses) || !time(review.intervalDays) || review.intervalDays > 30) throw fail("LIFE_PROGRESS_UNREADABLE");
  }
  if (value.activeReview !== null) {
    const run = value.activeReview;
    if (!object(run) || !safeId(run.id) || !time(run.startedAt) || !Array.isArray(run.ids) || run.ids.length > 100 || !run.ids.every((id) => safeId(id) && value.reviews[id]) || !object(run.answers) || Object.keys(run.answers).some((id) => !run.ids.includes(id))) throw fail("LIFE_PROGRESS_UNREADABLE");
    for (const answer of Object.values(run.answers)) if (!object(answer) || typeof answer.correct !== "boolean" || typeof answer.helped !== "boolean" || !time(answer.at)) throw fail("LIFE_PROGRESS_UNREADABLE");
    if (run.pendingHelp !== void 0 && (!object(run.pendingHelp) || Object.entries(run.pendingHelp).some(([id, value2]) => !run.ids.includes(id) || value2 !== true))) throw fail("LIFE_PROGRESS_UNREADABLE");
  }
  if (value.daily !== void 0) validateDaily(value.daily);
  if (value.tutor !== void 0 && (!object(value.tutor) || value.tutor.version !== 1 || !TUTORS.has(value.tutor.selected) || Object.keys(value.tutor).some((key) => !["version", "selected"].includes(key)))) throw fail("LIFE_PROGRESS_UNREADABLE");
  return value;
}
function createLifeProgress({ storage = globalThis.localStorage, owner = "guest", now = Date.now, uuid = () => crypto.randomUUID(), onChange = () => {
}, guard = () => {
}, mode = "local", scoped = mode === "account", save = null, getSaveStatus = null } = {}) {
  if (typeof owner !== "string" || !owner || owner.length > 200) throw TypeError("Life progress owner required");
  const key = scoped ? LIFE_PROGRESS_KEY : `${LIFE_PROGRESS_KEY}:${encodeURIComponent(owner)}`;
  let state = empty(owner), stopped = false, readError = null, writeError = null, saving = null;
  const lessons = /* @__PURE__ */ new Map(), questions = /* @__PURE__ */ new Map();
  const check2 = () => {
    guard();
    if (stopped) throw fail("ACCOUNT_CHANGED", "\uC774 \uACC4\uC815\uC758 \uC0DD\uD65C \uD55C\uAD6D\uC5B4 \uC5F0\uACB0\uC774 \uB05D\uB0AC\uC5B4\uC694.");
  };
  try {
    const raw = storage.getItem(key);
    if (raw !== null) {
      state = validate(raw, owner);
      backfillDaily(state);
    }
  } catch (error) {
    readError = error?.code ? error : fail("LIFE_PROGRESS_UNREADABLE", "\uC774 \uAE30\uAE30\uC758 \uC9C4\uB3C4\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uAE30\uC874 \uAE30\uB85D\uC740 \uBCF4\uC874\uD588\uC5B4\uC694.");
  }
  function status() {
    let transport = null;
    try {
      transport = getSaveStatus?.();
    } catch {
    }
    const phase = readError ? "unreadable" : writeError ? "unsaved" : scoped ? transport?.rejected ? "unsaved" : transport?.phase || "saving" : "device";
    return {
      owner,
      phase,
      scoped,
      saved: phase === "device" || phase === "synced",
      pending: transport?.pending || 0,
      rejected: transport?.rejected || 0,
      code: readError?.code || writeError?.code || transport?.code,
      message: readError ? "\uAE30\uC874 \uC9C4\uB3C4\uB97C \uC77D\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC6D0\uBCF8 \uAE30\uB85D\uC740 \uBCF4\uC874\uD588\uC5B4\uC694." : writeError ? "\uC9C4\uB3C4\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uD654\uBA74\uC758 \uC9C4\uD589\uC740 \uC720\uC9C0\uD558\uACE0 \uC788\uC5B4\uC694." : scoped ? transport?.message || "\uACC4\uC815\uC5D0 \uC0DD\uD65C \uD55C\uAD6D\uC5B4 \uC9C4\uB3C4\uB97C \uC800\uC7A5\uD558\uACE0 \uC788\uC5B4\uC694." : "\uC774 \uAE30\uAE30\uC5D0 \uC800\uC7A5\uB3FC\uC694."
    };
  }
  const emit = () => {
    try {
      onChange(api);
    } catch {
    }
  };
  function checkDailyWrite() {
    check2();
    if (readError) throw readError;
    const value = status();
    let transport;
    try {
      transport = getSaveStatus?.();
    } catch {
    }
    if (transport?.phase) value.phase = transport.phase;
    if (value.rejected) throw fail("LIFE_PROGRESS_REJECTED", "\uBCF4\uAD00\uB41C \uC9C4\uB3C4\uB97C \uBA3C\uC800 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    if (value.phase === "loading") throw fail("LIFE_PROGRESS_LOADING", "\uC9C4\uB3C4\uB97C \uBD88\uB7EC\uC624\uACE0 \uC788\uC5B4\uC694.");
    if (value.phase === "conflict") throw fail("REVISION_CONFLICT", "\uC0AC\uC6A9\uD560 \uC9C4\uB3C4\uB97C \uBA3C\uC800 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
    if (value.phase === "unreadable") throw fail("LIFE_PROGRESS_UNREADABLE", "\uAE30\uC874 \uC9C4\uB3C4\uB97C \uBA3C\uC800 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    if (value.phase === "stopped") throw fail("ACCOUNT_CHANGED", "\uC774 \uACC4\uC815\uC758 \uC0DD\uD65C \uD55C\uAD6D\uC5B4 \uC5F0\uACB0\uC774 \uB05D\uB0AC\uC5B4\uC694.");
  }
  function commit(next, { preserveDaily = false } = {}) {
    check2();
    if (readError) throw fail("LIFE_PROGRESS_UNREADABLE", "\uAE30\uC874 \uC9C4\uB3C4\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC6D0\uBCF8\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC5B4\uC694.");
    next.revision = state.revision + 1;
    if (!preserveDaily) fitDailyRecord(next);
    const raw = JSON.stringify(next);
    if (preserveDaily && (raw.length > 5e5 || new TextEncoder().encode(raw).length > 512 * 1024)) throw fail("PLAY_DATA_TOO_LARGE", "\uD29C\uD130 \uC120\uD0DD\uC744 \uC800\uC7A5\uD560 \uACF5\uAC04\uC774 \uBD80\uC871\uD574\uC694. \uAE30\uC874 \uD559\uC2B5 \uAE30\uB85D\uC740 \uBCF4\uC874\uD588\uC5B4\uC694.");
    try {
      storage.setItem(key, raw);
      writeError = null;
      state = next;
    } catch (error) {
      if (["REVISION_CONFLICT", "ACCOUNT_CHANGED", "PLAY_SESSION_ENDED"].includes(error.code)) throw error;
      state = next;
      writeError = error?.code ? error : fail("LIFE_STORAGE_UNAVAILABLE");
    }
    emit();
    return status();
  }
  function register(lesson2) {
    if (!object(lesson2) || !safeId(lesson2.id) || !safeId(lesson2.packId) || !Array.isArray(lesson2.questions) || !lesson2.questions.length) throw TypeError("Life lesson required");
    if (lesson2.questions.some((q) => !safeId(q.id) || !safeId(q.skillId) || !safeId(q.review?.id))) throw TypeError("Stable question and review ids required");
    lessons.set(lesson2.id, lesson2);
    for (const question2 of lesson2.questions) questions.set(question2.id, { ...question2, lessonId: lesson2.id, packId: lesson2.packId });
    return lesson2;
  }
  function catalog(packs = [], flat = []) {
    for (const lesson2 of flat) register(lesson2);
    for (const pack of packs) for (const lesson2 of pack.lessons || []) if (object(lesson2)) register({ ...lesson2, packId: lesson2.packId || pack.id });
  }
  function lessonState(id) {
    check2();
    const saved = state.lessons[id], lesson2 = lessons.get(id), ids = lesson2?.questions.map((q) => q.id) || saved?.questionIds || [];
    const cursor = ids.findIndex((qid) => !saved?.answers[qid]);
    const position = cursor < 0 ? ids.length : cursor, stage = clone2(saved?.stage || { phase: "intro", sceneIndex: 0, questionIndex: 0, helped: false });
    if (!stage.cafe && stage.phase === "questions" && stage.questionIndex !== position) stage.helped = false;
    return { id, status: !saved ? "new" : saved.completedAt !== null ? "completed" : "started", cursor: position, total: ids.length, answers: clone2(saved?.answers || {}), stage, attemptId: saved?.attemptId || null, completedAt: saved?.completedAt ?? null };
  }
  function startLesson(value, { replay = false } = {}) {
    check2();
    const lesson2 = object(value) ? register(value) : lessons.get(value);
    if (!lesson2) throw TypeError("Unknown life lesson");
    const previous = state.lessons[lesson2.id];
    if (!previous || replay) {
      const next = clone2(state);
      next.lessons[lesson2.id] = { attemptId: uuid(), startedAt: now(), completedAt: previous?.completedAt ?? null, stage: { phase: "intro", sceneIndex: 0, questionIndex: 0 }, questionIds: lesson2.questions.map((q) => q.id), answers: {} };
      next.activeLessonId = lesson2.id;
      commit(next);
    } else if (state.activeLessonId !== lesson2.id) {
      const next = clone2(state);
      next.activeLessonId = lesson2.id;
      commit(next);
    }
    return lessonState(lesson2.id);
  }
  function stageValue(id, run, { phase, sceneIndex = 0, questionIndex = 0, helped = false, cafe } = {}) {
    if (!run || !["intro", "story", "questions"].includes(phase) || !time(sceneIndex) || !time(questionIndex) || sceneIndex > 100 || questionIndex > run.questionIds.length || typeof helped !== "boolean") throw TypeError("Invalid lesson stage");
    if (cafe !== void 0 && (!isCafeLesson(id) || phase !== "questions" || !isCafeCheckpoint(cafe, id) || questionIndex !== cafe.step || sceneIndex !== cafe.step || cafe.phase === "complete" && run.questionIds.some((qid) => !run.answers[qid]))) throw TypeError("Invalid cafe stage");
    return { phase, sceneIndex, questionIndex, helped, ...cafe !== void 0 ? { cafe: clone2(cafe) } : {} };
  }
  function setStage(id, value = {}) {
    check2();
    const next = clone2(state);
    next.lessons[id].stage = stageValue(id, next.lessons[id], value);
    commit(next);
    return lessonState(id);
  }
  function recordAnswer({ lessonId, questionId, question: question2, correct, helped = false, choiceId = null, stage, order: order2, input } = {}) {
    check2();
    if (question2) questionId = question2.id;
    const run = state.lessons[lessonId], q = questions.get(questionId) || question2;
    if (!run || !q || !safeId(q.skillId) || !safeId(q.review?.id) || !run.questionIds.includes(questionId) || q.lessonId && q.lessonId !== lessonId || typeof correct !== "boolean" || typeof helped !== "boolean" || choiceId !== null && !safeId(choiceId)) throw TypeError("Invalid life answer");
    if (order2 !== void 0 && (lessonId !== CAFE_COMPOSE_ID || questionId !== "cafe-compose-order" || !isCafeOrder(order2, { complete: true })) || input !== void 0 && (!isCafeLesson(lessonId) || !isCafeListen(input) || input.mode === "listen" && !input.heard && !input.textShown)) throw TypeError("Invalid cafe response");
    if (run.answers[questionId]) return { ...lessonState(lessonId), duplicate: true };
    helped = helped || input?.mode === "listen" && input.textShown || run.stage?.phase === "questions" && run.stage?.questionIndex === run.questionIds.indexOf(questionId) && run.stage?.helped === true;
    const at = now(), next = clone2(state), id = q.review.id, old = next.reviews[id];
    next.lessons[lessonId].answers[questionId] = { correct, helped, choiceId, at, ...order2 !== void 0 ? { order: clone2(order2) } : {}, ...input !== void 0 ? { input: clone2(input) } : {} };
    if (stage !== void 0) next.lessons[lessonId].stage = stageValue(lessonId, next.lessons[lessonId], stage);
    const difficult = !correct || helped;
    const dueAt = old ? difficult ? Math.min(old.dueAt, at + MINUTE) : old.dueAt : at + (difficult ? MINUTE : DAY);
    next.reviews[id] = {
      id,
      questionId,
      lessonId,
      packId: q.packId || lessons.get(lessonId)?.packId,
      skillId: q.skillId,
      dueAt,
      lastAt: at,
      streak: difficult ? 0 : old?.streak ?? 0,
      lapses: (old?.lapses || 0) + (difficult ? 1 : 0),
      intervalDays: difficult ? 0 : old?.intervalDays ?? 1
    };
    dailyObservation(next, { questionId, lessonId, at, correct, helped });
    commit(next);
    return { ...lessonState(lessonId), duplicate: false };
  }
  function finishLesson(id) {
    check2();
    const run = state.lessons[id];
    if (!run) throw TypeError("Unknown started lesson");
    if (run.questionIds.some((qid) => !run.answers[qid])) throw fail("LIFE_LESSON_INCOMPLETE", "\uC544\uC9C1 \uB0A8\uC740 \uBB38\uC81C\uAC00 \uC788\uC5B4\uC694.");
    if (run.stage?.cafe && run.stage.cafe.phase !== "complete") throw fail("LIFE_CAFE_NOT_RECEIVED", "\uC544\uC9C1 \uC74C\uB8CC\uB97C \uBC1B\uC9C0 \uC54A\uC558\uC5B4\uC694. \uCEF5\uC744 \uBC1B\uACE0 \uC774\uC5B4\uAC00 \uC8FC\uC138\uC694.");
    const duplicate = run.completedAt !== null, next = clone2(state);
    if (!duplicate) next.lessons[id].completedAt = now();
    if (next.activeLessonId === id) next.activeLessonId = null;
    if (!duplicate || state.activeLessonId === id) commit(next);
    return { id, completed: true, duplicate, completedAt: next.lessons[id].completedAt, totalCompleted: Object.values(state.lessons).filter((v) => v.completedAt !== null).length };
  }
  function dueReviews(limit = 100) {
    check2();
    return Object.values(state.reviews).filter((v) => v.dueAt <= now()).sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id)).slice(0, Math.max(0, Math.min(100, limit))).map(clone2);
  }
  function startReview(limit = 6, preferredId = null) {
    check2();
    const existing = state.activeReview;
    if (existing && existing.ids.some((id) => !existing.answers[id])) return clone2(existing);
    const due = dueReviews(100);
    if (preferredId) {
      const index = due.findIndex((r) => r.id === preferredId);
      if (index > 0) due.unshift(...due.splice(index, 1));
    }
    const next = clone2(state), ids = due.slice(0, Math.max(0, Math.min(100, limit))).map((v) => v.id);
    if (!ids.length) return null;
    next.activeReview = { id: uuid(), startedAt: now(), ids, answers: {}, pendingHelp: {} };
    commit(next);
    return clone2(next.activeReview);
  }
  function markReviewHelp(id) {
    check2();
    const run = state.activeReview;
    if (!run || !run.ids.includes(id)) throw TypeError("Invalid review help");
    if (run.answers[id] || run.pendingHelp?.[id]) return clone2(run);
    const next = clone2(state);
    next.activeReview.pendingHelp = { ...next.activeReview.pendingHelp || {}, [id]: true };
    commit(next);
    return clone2(next.activeReview);
  }
  function answerReview({ id, reviewId, questionId, correct, helped = false, runId } = {}) {
    check2();
    const run = state.activeReview, keyId = id || reviewId || run?.ids.find((id2) => state.reviews[id2].questionId === questionId);
    if (!run || runId && run.id !== runId || !run.ids.includes(keyId) || typeof correct !== "boolean" || typeof helped !== "boolean") throw TypeError("Invalid review answer");
    if (run.answers[keyId]) return { duplicate: true, done: run.ids.every((id2) => run.answers[id2]), remaining: run.ids.filter((id2) => !run.answers[id2]).length };
    const at = now(), guided = dailyTime(at) && state.daily?.days[lifeDayKey(at)]?.items[state.reviews[keyId].questionId]?.guidedAt !== void 0;
    helped = helped || run.pendingHelp?.[keyId] === true || guided;
    const next = clone2(state), review = next.reviews[keyId], difficult = !correct || helped;
    review.streak = difficult ? 0 : review.streak + 1;
    review.lapses += difficult ? 1 : 0;
    review.intervalDays = difficult ? 0 : INTERVALS[Math.min(review.streak - 1, INTERVALS.length - 1)];
    review.dueAt = at + (difficult ? MINUTE : review.intervalDays * DAY);
    review.lastAt = at;
    next.activeReview.answers[keyId] = { correct, helped, at };
    const remaining = next.activeReview.ids.filter((id2) => !next.activeReview.answers[id2]).length;
    dailyObservation(next, { questionId: review.questionId, lessonId: review.lessonId, at, correct, helped });
    commit(next);
    return { duplicate: false, done: remaining === 0, remaining, dueAt: review.dueAt, intervalDays: review.intervalDays };
  }
  function recordGuidedPractice({ questionId, tutorId } = {}) {
    checkDailyWrite();
    const q = questions.get(questionId), review = q && state.reviews[q.review.id];
    if (!q || !dailyId(questionId) || !dailyId(q.lessonId) || !TUTORS.has(tutorId) || !(state.lessons[q.lessonId]?.questionIds.includes(questionId) || review?.questionId === questionId && review.lessonId === q.lessonId)) throw TypeError("Invalid guided life practice");
    const at = now(), dayKey = lifeDayKey(at), existing = state.daily?.days[dayKey]?.items[questionId];
    if (existing?.guidedAt !== void 0 && existing.guidedAt >= Math.max(existing.observedAt ?? 0, review?.lastAt ?? 0)) return { dayKey, item: clone2(existing), duplicate: true, status: status() };
    const next = clone2(state), daily = next.daily ??= { version: 1, days: {} }, day = daily.days[dayKey] ??= { items: {} };
    const item = { ...day.items[questionId], lessonId: q.lessonId, guidedAt: dailyEventTime(day, day.items[questionId], at), tutorId };
    day.items[questionId] = item;
    trimDaily(daily);
    commit(next);
    return { dayKey, item: clone2(item), duplicate: false, status: status() };
  }
  function markDayComplete() {
    checkDailyWrite();
    const at = now(), dayKey = lifeDayKey(at), day = state.daily?.days[dayKey];
    if (!day || !Object.keys(day.items).length) return { dayKey, closedAt: null, duplicate: false, empty: true, status: status() };
    const latest = Math.max(...Object.values(day.items).map(dailyLatest));
    if (day.closedAt !== void 0 && day.closedAt >= latest) return { dayKey, closedAt: day.closedAt, duplicate: true, empty: false, status: status() };
    const next = clone2(state), closedAt = Math.max(at, latest);
    next.daily.days[dayKey].closedAt = closedAt;
    commit(next);
    return { dayKey, closedAt, duplicate: false, empty: false, status: status() };
  }
  function selectedTutor() {
    check2();
    if (readError) throw readError;
    return state.tutor?.selected ?? null;
  }
  function selectTutor(tutor) {
    checkDailyWrite();
    if (!TUTORS.has(tutor)) throw TypeError("Invalid selected tutor");
    if (state.tutor?.selected === tutor) return { tutor, duplicate: true, status: status() };
    const next = clone2(state);
    next.tutor = { version: 1, selected: tutor };
    commit(next, { preserveDaily: true });
    return { tutor, duplicate: false, status: status() };
  }
  function summary(packs = [], flat = []) {
    check2();
    catalog(packs, flat);
    const ordered = packs.flatMap((pack) => (pack.lessons || []).map((value) => typeof value === "string" ? lessons.get(value) : lessons.get(value.id)).filter(Boolean));
    if (!ordered.length) ordered.push(...flat);
    const active = state.activeLessonId && lessons.get(state.activeLessonId);
    const visits = CAFE_LESSON_IDS.map((id) => ordered.find((l) => l.id === id)).filter(Boolean), nextVisit = visits.find((l) => state.lessons[l.id]?.completedAt == null);
    const latest = Object.entries(state.lessons).filter(([id, run]) => lessons.has(id) && run.completedAt !== null).reduce((last, [id, run]) => !last || run.completedAt >= last.at ? { id, at: run.completedAt } : last, null);
    const cafeNext = latest && isCafeLesson(latest.id) ? nextVisit || ordered.find((l) => l.packId === "cafe" && state.lessons[l.id]?.completedAt == null) : null;
    const next = active || cafeNext || ordered.find((lesson2) => state.lessons[lesson2.id]?.completedAt == null) || null;
    const due = dueReviews(), total = ordered.length, completed = ordered.filter((lesson2) => state.lessons[lesson2.id]?.completedAt != null).length;
    return {
      owner,
      completed,
      total,
      allCompleted: total > 0 && completed === total,
      nextLesson: next ? { ...next, progress: lessonState(next.id) } : null,
      resume: !!active,
      cafe: { completed: visits.filter((l) => state.lessons[l.id]?.completedAt != null).length, total: visits.length, nextNumber: next && isCafeLesson(next.id) ? CAFE_LESSON_IDS.indexOf(next.id) + 1 : null },
      dueCount: due.length,
      dueReviews: due.slice(0, 6),
      nextReviewAt: Object.values(state.reviews).length ? Math.min(...Object.values(state.reviews).map((v) => v.dueAt)) : null,
      packs: packs.map((pack) => {
        const ids = (pack.lessons || []).map((value) => typeof value === "string" ? value : value.id);
        return { id: pack.id, completed: ids.filter((id) => state.lessons[id]?.completedAt != null).length, total: ids.length };
      }),
      status: status()
    };
  }
  async function flush() {
    check2();
    if (readError) throw readError;
    if (saving) return saving;
    saving = (async () => {
      check2();
      if (writeError) {
        storage.setItem(key, JSON.stringify(state));
        writeError = null;
      }
      const result = save ? await save() : status();
      check2();
      emit();
      return result;
    })().finally(() => {
      saving = null;
    });
    return saving;
  }
  const api = Object.freeze({
    key,
    owner,
    status,
    summary,
    lessonState,
    startLesson,
    setStage,
    recordAnswer,
    finishLesson,
    dueReviews,
    startReview,
    markReviewHelp,
    answerReview,
    recordGuidedPractice,
    markDayComplete,
    selectedTutor,
    selectTutor,
    flush,
    exportSnapshot() {
      check2();
      return clone2(state);
    },
    stop() {
      stopped = true;
    },
    registerLesson: register
  });
  return api;
}

// experiences/synk-world-app/cafe-ui.mjs
var esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var drinkNames = { cold: "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4", warm: "\uB530\uB73B\uD55C \uC8FC\uC2A4", tea: "\uB530\uB73B\uD55C \uCC28", coldtea: "\uCC28\uAC00\uC6B4 \uCC28", takeout: "\uD3EC\uC7A5\uD55C \uCC28" };
function cafeDrink(kind, count = 1) {
  return kind ? `<span class="cafe-cups" aria-label="${esc(drinkNames[kind])} ${count}\uC794">${Array.from({ length: count }, () => `<span class="cafe-drink cafe-drink-${kind}" aria-hidden="true">${kind === "coldtea" ? '<span class="cafe-ice"></span>' : ""}</span>`).join("")}</span>` : "";
}
var actions = (text, attribute, extra = "") => `<div class="life-actions cafe-actions"><button class="felt-button" ${attribute}>${text} <span aria-hidden="true">\u2192</span></button>${extra}<button class="quiet-button" data-life-pause>\uC800\uC7A5\uD558\uACE0 \uC26C\uAE30</button></div>`;
var cast = (photo) => `<div class="cafe-friends">${["mongle", "kkamong", "marine"].map((id) => photo(id)).join("")}</div>`;
var speakerName = (id) => ({ mongle: "\uBABD\uAE00", kkamong: "\uAE4C\uBABD", marine: "\uB9C8\uB9B0", narrator: "\uC791\uC740 \uC774\uC57C\uAE30" })[id] || "\uCE5C\uAD6C";
function cafeMarkup(state, { photo, helped = false, firstAnswer = null, retryButton = () => "", lessonId = CAFE_LESSON_ID, speechAvailable = false, speechPhase = "idle" } = {}) {
  const visit = cafeVisitById(lessonId), receipt = cafeReceipt(state, lessonId), step = visit.steps[state.step];
  const receiptHtml = `<div class="cafe-ticket"><small>\uB098\uC758 \uC8FC\uBB38\uD45C</small><strong>${esc(receipt.label)}</strong><span>${esc(receipt.place)}</span></div>`;
  const scene2 = (message, kind = "counter") => `<section class="cafe-scene cafe-scene-${kind}" data-cafe-seat="${state.seat}" aria-label="${kind === "table" ? "\uCE5C\uAD6C\uC640 \uC549\uC740 \uC790\uB9AC" : "\uCE74\uD398 \uC8FC\uBB38\uB300"}"><div class="cafe-place-label">\uAD6C\uB984 \uD55C \uC794 <span>\uB3D9\uB124 \uCE74\uD398</span></div>${cast(photo)}<div class="cafe-tray" data-cafe-drink="${receipt.drink || "empty"}" data-cafe-count="${receipt.count}" data-cafe-received="${receipt.received}">${cafeDrink(receipt.drink, receipt.count)}</div><p class="cafe-scene-caption">${esc(message)}</p></section>`;
  if (state.phase === "welcome") return `<div class="cafe-welcome cafe-focus" tabindex="-1" data-cafe-visit="${lessonId}">${scene2(visit.caption)}<div class="cafe-welcome-copy"><small>${visit.number}\uBC88\uC9F8 \uBC29\uBB38 \xB7 \uCE74\uD398\uC5D0\uC11C \uBCF4\uB0B4\uB294 \uC791\uC740 \uD558\uB8E8</small><h3>${esc(visit.title)}</h3><p>${esc(visit.description)}</p>${lessonId !== CAFE_LESSON_ID ? `<div class="cafe-opening-lines">${lessonById(lessonId).scenes.map((line) => `<p><b>${speakerName(line.speaker)}</b> ${esc(line.text)}</p>`).join("")}</div>` : ""}${speechAvailable ? `<fieldset class="cafe-input-modes"><legend>\uC5B4\uB5BB\uAC8C \uC8FC\uBB38\uD574 \uBCFC\uAE4C\uC694?</legend><button class="plain-button" data-life-cafe-mode="listen" aria-pressed="${state.listen?.mode === "listen"}">\uB4E3\uACE0 \uC8FC\uBB38\uD558\uAE30</button><button class="plain-button" data-life-cafe-mode="read" aria-pressed="${state.listen?.mode !== "listen"}">\uC77D\uACE0 \uC8FC\uBB38\uD558\uAE30</button></fieldset>` : ""}<p class="cafe-soft-note">\uC11C\uB450\uB974\uC9C0 \uC54A\uC544\uB3C4 \uAD1C\uCC2E\uC544\uC694. \uC9C1\uC6D0\uACFC \uB2E4\uC2DC \uD655\uC778\uD560 \uC218 \uC788\uC5B4\uC694.</p></div></div>${actions("\uCE74\uD398\uC5D0 \uB4E4\uC5B4\uAC00\uAE30", "data-life-cafe-next")}`;
  if (state.phase === "break") return `<div class="cafe-break cafe-focus" tabindex="-1">${scene2(`${CAFE_SEATS[state.seat]}\uC5D0 \uC8FC\uC2A4 \uB450 \uC794\uC744 \uB193\uC558\uC5B4\uC694.`, "table")}<div class="cafe-break-copy"><small>\uC7A0\uAE50, \uC6B0\uB9AC \uC790\uB9AC</small><h3>\uB124 \uCEF5 \uD558\uB098, \uB0B4 \uCEF5 \uD558\uB098.</h3><p><b>\uBABD\uAE00</b> \u201C\uC6B0\uC640! \uAC19\uC774 \uB9C8\uC2DC\uB2C8\uAE4C \uB354 \uC2DC\uC6D0\uD574!\u201D</p><p><b>\uAE4C\uBABD</b> \u201C\uC774 \uBAB8 \uC790\uB9AC\uB3C4 \uC788\uC9C0. \u2026\uC5EC\uAE30 \uC7A0\uAE50 \uC549\uC744\uAC8C.\u201D</p><p><b>\uB9C8\uB9B0</b> \u201C\uD559\uAD50 \uAC08 \uC2DC\uAC04 \uD655\uC778. \uB530\uB73B\uD55C \uCC28, \uD55C \uC794 \uD544\uC694.\u201D</p>${receiptHtml}</div></div>${actions("\uB9C8\uB9B0\uC758 \uCC28 \uD3EC\uC7A5\uD558\uAE30", "data-life-cafe-next")}`;
  const q = cafeQuestion(state.step, lessonId), selection = state.choiceId ? step.options[state.choiceId] : null;
  const ready = state.phase === "response", repair = state.phase === "repair";
  const composed = step.compose && state.choiceId;
  const dialogue = composed ? state.phase === "response" ? "\uB124, \uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uC8FC\uBB38\uBC1B\uC558\uC5B4\uC694. \uC218\uB7C9\uB3C4 \uB2E4\uC2DC \uD655\uC778\uD560\uAC8C\uC694." : `\uB9D0\uC500\uD558\uC2E0 \uC8FC\uBB38\uC740 ${cafeOrderText(state.order)} \uCE5C\uAD6C\uC640 \uB9C8\uC2E4 \uB530\uB73B\uD55C \uCC28 \uB450 \uC794\uC774 \uB9DE\uC744\uAE4C\uC694?` : selection ? selection.response : step.staff, friend = selection ? selection.friend : step.friend;
  const listening = state.listen?.mode === "listen", needsHearing = listening && !state.listen.heard && !state.listen.textShown;
  const hiddenQuestion = listening && !state.listen.textShown && !state.choiceId;
  const speechControls = speechAvailable || listening ? `<div class="cafe-speech-controls"><button class="plain-button" data-life-cafe-speech>${!speechAvailable ? "\uC9C8\uBB38 \uC18C\uB9AC \uB2E4\uC2DC \uC900\uBE44\uD558\uAE30" : speechPhase === "playing" ? "\uC9C8\uBB38 \uB4E3\uAE30 \uC7A0\uAE50 \uBA48\uCD94\uAE30" : speechPhase === "paused" ? "\uC9C8\uBB38 \uC774\uC5B4 \uB4E3\uAE30" : state.listen?.heard ? "\uC9C1\uC6D0 \uC9C8\uBB38 \uB2E4\uC2DC \uB4E3\uAE30" : "\uC9C1\uC6D0 \uC9C8\uBB38 \uB4E3\uAE30"}</button>${listening ? `<button class="quiet-button" data-life-cafe-transcript>${state.listen.textShown ? "\uAE00\uC790 \uB3C4\uC6C0\uC744 \uBD24\uC5B4\uC694" : "\uAE00\uC790 \uB3C4\uC6C0 \uBCF4\uAE30"}</button>` : ""}</div><p class="cafe-speech-status" role="status">${speechPhase === "error" ? "\uC18C\uB9AC\uB97C \uC7AC\uC0DD\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB2E4\uC2DC \uB4E3\uAE30\uB97C \uB20C\uB7EC \uC8FC\uC138\uC694." : needsHearing ? "\uC9C8\uBB38\uC744 \uB05D\uAE4C\uC9C0 \uB4E4\uC740 \uB4A4 \uB9D0\uC744 \uACE8\uB77C \uC8FC\uC138\uC694." : listening ? "\uC9C8\uBB38\uC744 \uB4E3\uACE0, \uB0B4 \uB9D0\uB85C \uB2F5\uD574\uC694." : "\uAE00\uC744 \uC77D\uACE0 \uC8FC\uBB38\uD574\uC694."}</p>` : "";
  const trayMessage = ready ? state.step === 2 ? "\uCEF5\uC774 \uC900\uBE44\uB410\uC5B4\uC694. \uC774\uC81C \uC74C\uB8CC\uB97C \uBC1B\uC544\uC694." : "\uC8FC\uBB38\uD45C\uB97C \uD655\uC778\uD588\uC5B4\uC694. \uB2E4\uC74C \uBD80\uD0C1\uC744 \uC774\uC5B4\uAC00\uC694." : repair ? "\uC8FC\uBB38\uC744 \uD655\uC778\uD558\uACE0 \uC788\uC5B4\uC694. \uC544\uC9C1 \uC74C\uB8CC\uB97C \uBC1B\uC9C0 \uC54A\uC558\uC5B4\uC694." : "\uB9D0\uC744 \uACE0\uB974\uBA74 \uC8FC\uBB38\uD45C\uAC00 \uBC14\uB00C\uC5B4\uC694.";
  const menu = lessonId === CAFE_LESSON_ID ? state.step === 0 : step.menu;
  const optionHtml = step.compose ? cafeComposer(state, ready) : q.choices.map((c) => {
    const o = step.options[c.id], kind = lessonId === CAFE_LESSON_ID ? state.step === 2 ? o.drink : "cold" : o.previewDrink || o.drink;
    return `<button class="cafe-option ${state.choiceId === c.id ? "is-chosen" : ""}" data-life-cafe-choice="${c.id}" ${ready || needsHearing ? "disabled" : ""} aria-label="${esc(c.text)}">${cafeDrink(state.step === 0 && lessonId === CAFE_LESSON_ID ? o.drink : kind, menu ? Math.max(o.count, 1) : 1)}<span>${esc(c.text)}</span>${menu ? `<small>${o.previewDrink ? "\uD488\uC808 \uBA54\uB274" : `${o.count}\uC794`}</small>` : ""}</button>`;
  }).join("");
  const primary = step.compose && !ready ? actions(isCafeOrder(state.order, { complete: true }) ? "\uC774 \uC8FC\uBB38\uC73C\uB85C \uBD80\uD0C1\uD558\uAE30" : "\uC74C\uB8CC\xB7\uC628\uB3C4\xB7\uC794 \uC218\uB97C \uACE8\uB77C \uC8FC\uC138\uC694", `data-life-cafe-submit ${needsHearing || !isCafeOrder(state.order, { complete: true }) ? "disabled" : ""}`) : actions(ready ? step.next : repair ? "\uC8FC\uBB38\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694" : "\uC9C1\uC6D0\uC5D0\uAC8C \uB9D0\uC744 \uACE8\uB77C \uC8FC\uC138\uC694", `data-life-cafe-next ${ready ? "" : "disabled"}`);
  const seats = ready && state.step === visit.seatStep ? `<fieldset class="cafe-seats"><legend>\uC5B4\uB290 \uC790\uB9AC\uC5D0 \uC549\uC744\uAE4C\uC694?</legend>${Object.entries(CAFE_SEATS).map(([id, label]) => `<button class="plain-button" data-life-cafe-seat="${id}" aria-pressed="${state.seat === id}">${label}</button>`).join("")}</fieldset>` : "";
  return `<div class="cafe-session-meta" data-cafe-visit="${lessonId}"><span>${visit.number}\uBC88\uC9F8 \uCE74\uD398 \uBC29\uBB38 \xB7 ${step.name}</span><span>${state.step + 1} / 3</span></div><div class="cafe-play-layout ${step.compose ? "is-composing" : ""}"><div class="cafe-world">${scene2(trayMessage)}${receiptHtml}</div><section class="cafe-conversation" aria-label="\uC9C1\uC6D0\uACFC \uC8FC\uBB38\uD558\uAE30"><div class="cafe-focus" tabindex="-1"><small>${step.name}</small><h3>${esc(step.goal || q.prompt)}</h3>${step.goal || step.compose ? "" : `<p class="cafe-goal">${esc(q.context)}</p>`}</div>${step.notice ? `<p class="cafe-menu-notice">${esc(step.notice)}</p>` : ""}<div class="cafe-staff" role="status"><small>\uCE74\uD398 \uC9C1\uC6D0${hiddenQuestion ? " \xB7 \uADC0 \uAE30\uC6B8\uC5EC \uB4E4\uC5B4\uC694" : ""}</small><p ${hiddenQuestion ? "hidden" : ""}>${esc(dialogue)}</p>${speechControls}</div><p class="cafe-friend-line"><b>${speakerName(step.speaker)}</b> ${esc(friend)}</p>${repair ? '<p class="cafe-repair-note">\uB2E4\uC2DC \uB9D0\uD574 \uBCFC\uAE4C\uC694? \uC9C1\uC6D0\uC774 \uC8FC\uBB38\uC744 \uBC14\uAFD4 \uC904 \uAC70\uC608\uC694.</p>' : ""}<div class="cafe-options ${step.compose ? "cafe-compose-options" : menu ? "cafe-menu" : "cafe-responses"}" aria-label="\uC9C1\uC6D0\uC5D0\uAC8C \uD560 \uB9D0">${optionHtml}</div>${seats}<button class="quiet-button cafe-help" data-life-cafe-help aria-expanded="${helped}">\uC8FC\uBB38 \uD45C\uD604 \uB3C4\uC6C0</button><p class="life-hint" ${helped ? "" : "hidden"}>${esc(step.hint)}</p>${firstAnswer && (!firstAnswer.correct || firstAnswer.helped) ? '<p class="cafe-review-note">\uB3C4\uC6C0\uC774 \uD544\uC694\uD588\uB358 \uD45C\uD604\uC740 \uBCF5\uC2B5\uC5D0 \uB0A8\uACA8 \uB458\uAC8C\uC694.</p>' : ""}${repair || helped || firstAnswer && (!firstAnswer.correct || firstAnswer.helped) ? retryButton(q) : ""}</section></div>${primary}`;
}
function cafeComposer(state, ready) {
  const fields = [["drink", "\uC74C\uB8CC", [["juice", "\uC8FC\uC2A4"], ["tea", "\uCC28"]]], ["temperature", "\uC628\uB3C4", [["warm", "\uB530\uB73B\uD558\uAC8C"], ["cold", "\uCC28\uAC11\uAC8C"]]], ["count", "\uC794 \uC218", [[1, "\uD55C \uC794"], [2, "\uB450 \uC794"], [3, "\uC138 \uC794"]]]];
  return `<div class="cafe-composer">${fields.map(([field, title, options]) => `<fieldset><legend>${title}</legend><div>${options.map(([value, label]) => `<button class="plain-button" data-life-cafe-word="${field}" data-cafe-value="${value}" aria-pressed="${state.order[field] === value}" ${ready ? "disabled" : ""}>${label}</button>`).join("")}</div></fieldset>`).join("")}<p class="cafe-my-sentence" aria-live="polite"><small>\uB0B4\uAC00 \uB9CC\uB4E0 \uC8FC\uBB38</small><strong>${esc(cafeOrderText(state.order))}</strong></p></div>`;
}
function createCafeSpeech({ asset, onChange = () => {
}, audioFactory = (url) => new Audio(url), fetcher = fetch }) {
  let clips = {}, available = false, phase = "idle", current = null, currentId = null, disposed = false, serial = 0, endCallback = null;
  const notify = () => {
    if (!disposed) onChange({ available, phase, lineId: currentId });
  };
  function stop() {
    serial++;
    if (current) {
      current.pause();
      current.onended = null;
      current.onerror = null;
    }
    current = null;
    currentId = null;
    endCallback = null;
    phase = "idle";
  }
  async function prepare() {
    try {
      const response = await fetcher(asset("cafe-voice/manifest.json"), { cache: "no-cache" });
      if (!response.ok) throw Error("Questions unavailable");
      const bank = await response.json();
      const required = CAFE_VISITS.flatMap((v) => v.steps.map((step, i) => ({ id: `${v.id}-${i + 1}`, text: step.staff })));
      if (bank.version !== 1 || bank.approved !== true || !bank.clips || required.some(({ id, text }) => {
        const c = bank.clips[id];
        return !c || c.text !== text || c.file !== `${id}.mp3` || !Number.isFinite(c.durationSeconds) || c.durationSeconds <= 0 || c.durationSeconds > 15;
      })) throw Error("Question bank incomplete");
      if (!disposed) {
        clips = bank.clips;
        available = true;
        notify();
      }
      return available;
    } catch {
      if (!disposed) {
        available = false;
        notify();
      }
      return false;
    }
  }
  async function play(id, onEnded) {
    if (disposed || !available || !clips[id]) throw Error("\uC9C8\uBB38 \uC74C\uC131\uC744 \uC900\uBE44\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694.");
    if (currentId !== id || phase === "error") {
      stop();
      currentId = id;
      current = audioFactory(asset("cafe-voice/" + clips[id].file));
      current.preload = "auto";
      current.volume = 0.85;
    }
    if (current.ended) current.currentTime = 0;
    const token = ++serial;
    endCallback = onEnded;
    current.onended = () => {
      if (disposed || token !== serial) return;
      phase = "ended";
      const done = endCallback;
      notify();
      done?.();
    };
    current.onerror = () => {
      if (!disposed && token === serial) {
        phase = "error";
        notify();
      }
    };
    try {
      await current.play();
      if (!disposed && token === serial) {
        phase = "playing";
        notify();
      }
    } catch {
      if (!disposed && token === serial) {
        phase = "error";
        notify();
      }
      throw Error("\uC9C8\uBB38 \uC18C\uB9AC\uB97C \uC7AC\uC0DD\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB2E4\uC2DC \uB4E3\uAE30\uB97C \uB20C\uB7EC \uC8FC\uC138\uC694.");
    }
  }
  function pause() {
    if (current && !current.paused) {
      current.pause();
      phase = "paused";
      notify();
    }
  }
  const visibility = () => {
    if (document.hidden) pause();
  };
  document.addEventListener("visibilitychange", visibility);
  return { prepare, play, pause, stop, available: () => available, metrics: () => ({ available, phase, lineId: currentId, currentTime: current?.currentTime || 0, paused: current?.paused ?? true }), dispose() {
    disposed = true;
    stop();
    document.removeEventListener("visibilitychange", visibility);
  } };
}
function cafeCompletionMarkup({ photo, nextLesson, lessonId = CAFE_LESSON_ID, state }) {
  const visit = cafeVisitById(lessonId), ending = visit.ending, receipt = state ? cafeReceipt(state, lessonId) : null;
  return `<div class="cafe-complete cafe-focus" tabindex="-1" data-cafe-visit="${lessonId}">${cast(photo)}<small>${visit.number}\uBC88\uC9F8 \uCE74\uD398 \uAE30\uB85D</small><h3>${esc(ending.title)}</h3><p>${esc(ending.text)}</p><div class="cafe-complete-orders ${ending.orders.length === 1 ? "is-single" : ""}">${ending.orders.map((o) => `<div data-cafe-drink="${o.drink}" data-cafe-count="${o.count}" data-cafe-received="true">${cafeDrink(o.drink, o.count)}<strong>${esc(visit.seatStep === 2 ? receipt?.place || o.place : o.place)}</strong><span>${esc(o.label)}</span></div>`).join("")}</div>${ending.lines ? `<div class="cafe-ending-lines">${ending.lines.map((line) => `<p><b>${speakerName(line.speaker)}</b> ${esc(line.text)}</p>`).join("")}</div>` : ""}<p class="cafe-soft-note">\uD544\uC694\uD55C \uD45C\uD604\uC740 \uC0C8 \uC0C1\uD669\uC73C\uB85C \uBCF5\uC2B5\uD574\uC694.</p></div><div class="life-actions cafe-actions">${nextLesson ? `<button class="felt-button" data-life-lesson="${nextLesson.id}">${nextLesson.type === "compose" ? "\uB0B4 \uB9D0\uB85C \uC8FC\uBB38\uD558\uAE30" : nextLesson.type === "visit" ? "\uB2E4\uC74C \uCE74\uD398 \uC774\uC57C\uAE30" : "\uCE74\uD398 \uD45C\uD604 \uB354 \uC775\uD788\uAE30"} <span aria-hidden="true">\u2192</span></button>` : '<button class="felt-button" data-life-review>\uB0B4 \uBCF5\uC2B5 \uC77C\uC815 \uBCF4\uAE30 <span aria-hidden="true">\u2192</span></button>'}<button class="plain-button" data-life-lesson="${lessonId}">\uC774\uBC88 \uBC29\uBB38 \uB2E4\uC2DC \uBCF4\uAE30</button><button class="quiet-button" data-life-home>\uB9C8\uB8E8\uB85C \uB3CC\uC544\uAC00\uAE30</button></div>`;
}

// experiences/synk-world-app/life-ui.mjs
if (!document.querySelector("[data-life-style]")) {
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = new URL("./life-ui.css", import.meta.url).href;
  style.dataset.lifeStyle = "true";
  document.head.append(style);
}
var escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var friends = { mongle: { name: "\uBABD\uAE00", file: "friend-mongle.webp" }, kkamong: { name: "\uAE4C\uBABD", file: "friend-kkamong.webp" }, marine: { name: "\uB9C8\uB9B0", file: "friend-marine.webp" } };
var phaseNames = { expressions: "\uD45C\uD604 \uB9CC\uB098\uAE30", story: "\uC138 \uCE5C\uAD6C \uC774\uC57C\uAE30", apply: "\uC0DD\uD65C\uC5D0\uC11C \uC368 \uBCF4\uAE30", visit: "\uB2E4\uC74C \uCE74\uD398 \uC774\uC57C\uAE30", compose: "\uB0B4 \uC8FC\uBB38 \uB9CC\uB4E4\uAE30" };
var dayLabel = (at) => Number.isFinite(at) ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(at)) : "";
function createLifeExperience({ home, getProgress, show = (title, html, options) => home.showPanel(title, html, options), asset, onSummary = () => {
} }) {
  const panel = document.querySelector("#world-panel"), content = document.querySelector("#panel-content");
  for (const [variable, file] of Object.entries({ "--cafe-room": "cafe-room-v1.webp", "--cafe-drinks": "cafe-drinks-v2.png", "--cafe-ice": "cafe-ice.webp" })) panel.style.setProperty(variable, `url("${asset("home/" + file)}")`);
  let context = null, shown = false, rendering = false, ended = false, reviewRun = null, lastFeedback = null, helped = false, generation = 0, timer, cafeRun = null, companion = null, place = "life";
  const practised = /* @__PURE__ */ new Set();
  const exposedTransfers = /* @__PURE__ */ new Set();
  const speech = createCafeSpeech({ asset, onChange() {
    if (ended || !shown || context?.phase !== "cafe") return;
    const metrics = speech.metrics(), button = content.querySelector("[data-life-cafe-speech]"), status = content.querySelector(".cafe-speech-status");
    if (button) button.textContent = !metrics.available ? "\uC9C8\uBB38 \uC18C\uB9AC \uB2E4\uC2DC \uC900\uBE44\uD558\uAE30" : metrics.phase === "playing" ? "\uC9C8\uBB38 \uB4E3\uAE30 \uC7A0\uAE50 \uBA48\uCD94\uAE30" : metrics.phase === "paused" ? "\uC9C8\uBB38 \uC774\uC5B4 \uB4E3\uAE30" : cafeRun.listen?.heard ? "\uC9C1\uC6D0 \uC9C8\uBB38 \uB2E4\uC2DC \uB4E3\uAE30" : "\uC9C1\uC6D0 \uC9C8\uBB38 \uB4E3\uAE30";
    if (status && metrics.phase === "error") status.textContent = "\uC18C\uB9AC\uB97C \uC7AC\uC0DD\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB2E4\uC2DC \uB4E3\uAE30\uB97C \uB20C\uB7EC \uC8FC\uC138\uC694.";
    companion?.update(tutorState());
  } });
  void speech.prepare();
  const summary = () => getProgress().summary(PACKS, LESSONS);
  const photo = (speaker, size = "") => friends[speaker] ? `<img class="life-friend ${size}" src="${asset("home/" + friends[speaker].file)}" alt="${friends[speaker].name}" width="384" height="384">` : "";
  function updateHome() {
    if (ended) return;
    try {
      const value = summary();
      home.updateLearning?.(value, { snapshot: getProgress().exportSnapshot(), lessons: LESSONS, preparePractice: prepareHomePractice, completePractice: completeTutorPractice, finishDay: finishTutorDay });
      onSummary(value);
    } catch {
    }
  }
  function completeTutorPractice(questionId, tutorId) {
    if (ended) throw Error("\uD559\uC2B5 \uC5F0\uACB0\uC774 \uBC14\uB00C\uC5C8\uC5B4\uC694.");
    return getProgress().recordGuidedPractice({ questionId, tutorId });
  }
  function finishTutorDay() {
    if (ended) throw Error("\uD559\uC2B5 \uC5F0\uACB0\uC774 \uBC14\uB00C\uC5C8\uC5B4\uC694.");
    return getProgress().markDayComplete();
  }
  function prepareHomePractice(id) {
    if (ended) return false;
    try {
      const p = getProgress(), s = p.status();
      if (["loading", "conflict", "unreadable"].includes(s.phase) || s.rejected) return false;
      const snapshot = p.exportSnapshot(), record = Object.values(snapshot.reviews).find((r) => r.questionId === id);
      if (!record || record.lapses <= 0 || record.streak !== 0) return false;
      exposedTransfers.add(record.id);
      const run = record.dueAt <= Date.now() ? p.startReview(6, record.id) : snapshot.activeReview;
      if (run?.ids.includes(record.id) && !run.answers[record.id]) p.markReviewHelp(record.id);
      return true;
    } catch {
      return false;
    }
  }
  function statusLine() {
    const s = getProgress().status();
    return `<p class="life-save-status" data-save-phase="${escape(s.phase)}" role="status">${escape(s.message)}</p>`;
  }
  function tutorState() {
    const l = lessonById(context?.lessonId), cafe = context?.phase === "cafe";
    const original = context?.phase === "review" ? l?.questions.find((q2) => q2.review.id === context.reviewQuestion?.id) : l?.questions[context?.questionIndex];
    const q = context?.phase === "review" ? context.reviewQuestion : original;
    const current = cafe ? ["choose", "repair", "response"].includes(cafeRun.phase) : ["questions", "review"].includes(context?.phase);
    const requiresHearing = cafe && current && cafeRun.listen?.mode === "listen" && !cafeRun.listen.heard && !cafeRun.listen.textShown;
    return {
      scope: place,
      phase: cafe ? cafeRun.phase : context?.phase,
      question: current ? q : null,
      questionId: original?.id,
      answered: cafe ? !!cafeRun.choiceId : !!lastFeedback,
      feedback: current && !cafe ? lastFeedback : null,
      helped,
      requiresHearing,
      listening: cafe && speech.metrics().phase === "playing",
      compose: cafe && context.lessonId === CAFE_COMPOSE_ID && cafeRun.step === 0
    };
  }
  function tutorHint() {
    speech.pause();
    if (!context) return;
    if (context.phase === "cafe") {
      if (tutorState().requiresHearing) cafeRun = { ...cafeRun, listen: { ...cafeRun.listen, textShown: true } };
      helped = true;
      persistCafe();
      renderCafe();
      return;
    }
    if (!["questions", "review"].includes(context.phase)) return;
    if (!lastFeedback) {
      helped = true;
      if (context.phase === "questions") persistStage();
      else getProgress().markReviewHelp(context.reviewId);
    }
    const hint = content.querySelector(".life-hint");
    if (hint) hint.hidden = false;
    content.querySelector("[data-life-help]")?.setAttribute("aria-expanded", "true");
    companion?.update({ ...tutorState(), hinting: true });
  }
  function prepareTutorPractice(id) {
    const value = tutorState();
    if (value.questionId !== id || value.answered) return;
    helped = true;
    if (context.phase === "cafe") persistCafe();
    else if (context.phase === "questions") persistStage();
    else if (context.phase === "review") getProgress().markReviewHelp(context.reviewId);
  }
  const retryButton = (q) => home.mountLifeTutor && home.tutor?.().tutor ? `<button class="life-tutor-retry" data-life-tutor-retry="${escape(q.id)}">\uD29C\uD130\uC640 \uC774 \uD45C\uD604 \uB2E4\uC2DC \uC5F0\uC2B5</button>` : "";
  function paint(title, html, { type = "life-library", focus = ".life-heading", eyebrow = "LIFE IN KOREA" } = {}) {
    generation++;
    rendering = true;
    show(title, html + statusLine(), { type, eyebrow, nav: "play" });
    const tutor = home.mountLifeTutor?.({ state: tutorState(), snapshot: getProgress().exportSnapshot(), lessons: LESSONS, practised: [...practised], onHint: tutorHint, onPause: () => speech.pause(), onPreparePractice: prepareTutorPractice, onPracticeSuccess: (id) => completeTutorPractice(id, home.tutor?.().tutor), onPracticeComplete: (id) => {
      practised.add(id);
      companion?.update({ ...tutorState(), practiceCompleted: true });
    } });
    companion = tutor;
    home.attachPanelResource({ dispose() {
      tutor?.dispose();
      if (companion === tutor) companion = null;
      if (!rendering) {
        speech.stop();
        shown = false;
        generation++;
        try {
          void getProgress().flush().catch(() => {
          });
        } catch {
        }
        context = null;
        reviewRun = null;
        lastFeedback = null;
      }
    } });
    rendering = false;
    shown = true;
    content.querySelector(focus)?.focus({ preventScroll: true });
    updateHome();
  }
  function ensureReadable() {
    const s = getProgress().status();
    if (s.phase !== "unreadable") return true;
    paint("\uC9C4\uB3C4\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694", `<p class="panel-description">${escape(s.message)}</p><p class="dialog-note">\uAE30\uC874 \uAE30\uB85D\uC740 \uC720\uC9C0\uD558\uACE0 \uC788\uC5B4\uC694. \uB098\uC758 \uACF5\uAC04\uC5D0\uC11C \uC5F0\uACB0 \uC0C1\uD0DC\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.</p>`);
    return false;
  }
  function packCard(pack2, { story = false } = {}) {
    const p = getProgress(), done = pack2.lessons.filter((l) => p.lessonState(l.id).status === "completed").length, episode = pack2.lessons.find((l) => l.type === "story");
    return `<button class="life-pack-card" data-life-${story ? "lesson" : "pack"}="${story ? episode.id : pack2.id}"><span class="life-card-art">${photo(story ? "kkamong" : "mongle")}</span><span><small>${story ? "\uC138 \uCE5C\uAD6C \uC774\uC57C\uAE30" : "\uC0DD\uD65C \uD55C\uAD6D\uC5B4 \xB7 " + pack2.level}</small><strong>${escape(story ? episode.title : pack2.title)}</strong><span>${escape(story ? episode.goal : pack2.subtitle)}</span><em>${story ? p.lessonState(episode.id).status === "completed" ? "\uC77D\uC740 \uC774\uC57C\uAE30 \xB7 \uB2E4\uC2DC \uBCF4\uAE30" : "\uD568\uAED8 \uC77D\uACE0 \uACE8\uB77C\uC694" : `${done} / ${pack2.lessons.length} \uB2E8\uACC4`}</em></span><span class="life-card-arrow" aria-hidden="true">\u2197</span></button>`;
  }
  function packs() {
    if (!ensureReadable()) return;
    place = "life";
    context = null;
    paint("\uC791\uC740 \uB9D0\uB85C \uC2DC\uC791\uD558\uB294 \uD55C\uAD6D \uC0DD\uD65C", `<div class="life-heading" tabindex="-1"><p>\uC778\uC0AC\uBD80\uD130 \uC57D\uC18D\uAE4C\uC9C0, \uCE5C\uAD6C\uB4E4\uACFC \uD55C \uD329\uC529.</p><p class="life-library-note">${PACKS.length}\uAC1C \uC0DD\uD65C \uD329 \xB7 ${LESSONS.length}\uAC1C \uC9E7\uC740 \uD559\uC2B5</p></div><div class="life-pack-grid">${PACKS.map((p) => packCard(p)).join("")}</div><div class="life-library-footer"><button class="plain-button" data-life-stories>\uC138 \uCE5C\uAD6C \uC774\uC57C\uAE30 \uBAA8\uC544 \uBCF4\uAE30</button><button class="plain-button" data-life-review>\uC624\uB298\uC758 \uBCF5\uC2B5</button></div>`);
  }
  function cafeVisitCards() {
    const p = getProgress();
    return CAFE_VISITS.map((visit) => {
      const state = p.lessonState(visit.id);
      return `<button data-life-lesson="${visit.id}" class="life-lesson-card cafe-visit-card"><span class="life-step-number">${String(visit.number).padStart(2, "0")}</span><span><small>${visit.number}\uBC88\uC9F8 \uCE74\uD398 \uBC29\uBB38</small><strong>${escape(visit.title)}</strong><span>${escape(visit.description)}</span></span><em>${state.status === "completed" ? "\uB2E4\uB140\uC654\uC5B4\uC694 \xB7 \uB2E4\uC2DC \uBCF4\uAE30" : state.status === "started" ? "\uC774\uC5B4\uC11C \uD558\uAE30" : "\uB4E4\uB974\uAE30"}</em></button>`;
    }).join("");
  }
  function stories() {
    if (!ensureReadable()) return;
    place = "life";
    context = null;
    paint("\uAE4C\uBABD\xB7\uBABD\uAE00\xB7\uB9C8\uB9B0\uC758 \uC791\uC740 \uD558\uB8E8", `<div class="life-heading" tabindex="-1"><div class="life-cast">${Object.keys(friends).map((f) => photo(f)).join("")}</div><p>\uC8FC\uBB38\uD558\uACE0, \uAE38\uC744 \uCC3E\uACE0, \uC57D\uC18D\uC744 \uC9C0\uCF1C\uC694.<br>\uC138 \uCE5C\uAD6C\uC640 \uC77D\uACE0 \uACE0\uB974\uB294 \uC0DD\uD65C \uC774\uC57C\uAE30.</p></div><div class="life-pack-grid">${PACKS.map((p) => packCard(p, { story: true })).join("")}</div><h3 class="cafe-library-title">\uB0B4\uAC00 \uD568\uAED8 \uB9CC\uB4DC\uB294 \uCE74\uD398 \uC774\uC57C\uAE30</h3><div class="life-lesson-list">${cafeVisitCards()}</div>`);
  }
  function pack(id) {
    if (!ensureReadable()) return;
    const value = packById(id);
    if (!value) return;
    place = id === "cafe" ? "cafe" : "life";
    context = null;
    const p = getProgress(), activeId = p.exportSnapshot().activeLessonId, nextVisit = CAFE_VISITS.find((v) => v.id === activeId) || CAFE_VISITS.find((v) => p.lessonState(v.id).status === "started") || CAFE_VISITS.find((v) => p.lessonState(v.id).status !== "completed") || CAFE_VISITS[0], visited = CAFE_VISITS.filter((v) => p.lessonState(v.id).status === "completed").length;
    const cafe = id === "cafe" ? `<div class="cafe-pack-preview"><img src="${asset("home/cafe-room-v1.webp")}" alt="\uD587\uC0B4\uC774 \uB4DC\uB294 \uB3D9\uB124 \uCE74\uD398" width="1600" height="900"><div><small>\uC6B0\uB9AC\uC758 \uCE74\uD398 \xB7 ${visited} / ${CAFE_VISITS.length}\uBC88\uC758 \uC791\uC740 \uD558\uB8E8</small><h3>${escape(nextVisit.title)}</h3><p>${escape(nextVisit.description)}</p><button class="felt-button" data-life-lesson="${nextVisit.id}">${p.lessonState(nextVisit.id).status === "started" ? "\uCE74\uD398\uC5D0\uC11C \uC774\uC5B4\uC11C \uD558\uAE30" : nextVisit.number === 1 ? "\uCE74\uD398\uC5D0 \uB4E4\uC5B4\uAC00\uAE30" : "\uB2E4\uC74C \uCE74\uD398 \uC774\uC57C\uAE30"} <span aria-hidden="true">\u2192</span></button></div></div><h3 class="cafe-library-title">\uB2E4\uC2DC \uC62C \uB54C\uB9C8\uB2E4 \uB2E4\uB978 \uD558\uB8E8</h3><div class="life-lesson-list cafe-visit-list">${cafeVisitCards()}</div>` : "";
    paint(value.title, `${cafe}<div class="life-heading" tabindex="-1"><p class="life-pack-description">${escape(value.subtitle)}</p><p class="life-library-note">${escape(value.level)} \xB7 ${id === "cafe" ? "\uC8FC\uBB38 \uC804\uC5D0 \uD45C\uD604\uACFC \uC774\uC57C\uAE30\uB3C4 \uB9CC\uB098 \uBCF4\uC138\uC694." : "\uD45C\uD604 \u2192 \uC774\uC57C\uAE30 \u2192 \uC0DD\uD65C \uC801\uC6A9"}</p></div><div class="life-lesson-list">${value.lessons.filter((l) => id !== "cafe" || !isCafeLesson(l.id)).map((l, i) => {
      const state = p.lessonState(l.id);
      return `<button data-life-lesson="${l.id}" class="life-lesson-card"><span class="life-step-number">${String(i + 1).padStart(2, "0")}</span><span><small>${phaseNames[l.type]}</small><strong>${escape(l.title)}</strong><span>${escape(l.goal)}</span></span><em>${state.status === "completed" ? "\uC644\uB8CC \xB7 \uB2E4\uC2DC \uD558\uAE30" : state.status === "started" ? "\uC774\uC5B4\uC11C \uD558\uAE30" : "\uC2DC\uC791"}</em></button>`;
    }).join("")}</div><div class="life-library-footer"><button class="plain-button" data-life-packs>\uC804\uCCB4 \uC0DD\uD65C \uD329</button><button class="plain-button" data-life-review>\uBCF5\uC2B5 \uC77C\uC815 \uBCF4\uAE30</button></div>`);
  }
  function next() {
    if (!ensureReadable()) return;
    const s = summary();
    if (s.nextLesson) return start(s.nextLesson.id);
    if (s.dueCount) return review();
    packs();
  }
  function start(id) {
    if (!ensureReadable()) return;
    const lesson2 = lessonById(id);
    if (!lesson2) return;
    place = lesson2.packId === "cafe" ? "cafe" : "life";
    speech.stop();
    const p = getProgress();
    p.summary(PACKS, LESSONS);
    const previous = p.lessonState(id), state = p.startLesson(lesson2, { replay: previous.status === "completed" && previous.cursor === previous.total });
    context = { lessonId: id, phase: state.stage.phase, sceneIndex: state.stage.sceneIndex, questionIndex: state.cursor };
    reviewRun = null;
    lastFeedback = null;
    helped = state.stage.helped === true;
    cafeRun = null;
    if (isCafeLesson(id)) {
      cafeRun = resumeCafe(state, id);
      if (!cafeRun.listen) cafeRun = { ...cafeRun, listen: { mode: cafeRun.phase === "welcome" && speech.available() ? "listen" : "read", heard: false, textShown: false } };
      context.phase = "cafe";
      if (cafeRun.phase === "complete") return finishCafe();
      persistCafe();
      return renderCafe();
    }
    if (state.cursor >= lesson2.questions.length) return finish();
    if (state.cursor > 0) context.phase = "questions";
    renderLesson();
  }
  function cafeStage(value = cafeRun) {
    return { phase: "questions", sceneIndex: value.step, questionIndex: value.step, helped, cafe: value };
  }
  function persistCafe() {
    getProgress().setStage(context.lessonId, cafeStage());
  }
  function renderCafe() {
    context.phase = "cafe";
    context.questionIndex = cafeRun.step;
    const q = cafeQuestion(cafeRun.step, context.lessonId), first = q ? getProgress().lessonState(context.lessonId).answers[q.id] : null;
    paint("\uAD6C\uB984 \uD55C \uC794, \uCE74\uD398", cafeMarkup(cafeRun, { photo, helped, firstAnswer: first, retryButton, lessonId: context.lessonId, speechAvailable: speech.available(), speechPhase: speech.metrics().phase }), { type: "life-cafe", focus: ".cafe-focus", eyebrow: "LIFE IN KOREA \xB7 CAFE" });
  }
  function ensureHeard() {
    if (cafeRun.listen?.mode === "listen" && !cafeRun.listen.heard && !cafeRun.listen.textShown) throw Error("\uC9C1\uC6D0 \uC9C8\uBB38\uC744 \uB05D\uAE4C\uC9C0 \uB4E3\uAC70\uB098 \uAE00\uC790 \uB3C4\uC6C0\uC744 \uC5F4\uC5B4 \uC8FC\uC138\uC694.");
  }
  function cafeChoose(choiceId) {
    ensureHeard();
    speech.stop();
    const id = context.lessonId, next2 = chooseCafe(cafeRun, choiceId, id), p = getProgress(), q = cafeQuestion(cafeRun.step, id);
    if (!p.lessonState(id).answers[q.id]) p.recordAnswer({ lessonId: id, questionId: q.id, choiceId, correct: choiceId === q.answerId, helped, stage: cafeStage(next2), input: cafeRun.listen });
    else p.setStage(id, cafeStage(next2));
    cafeRun = next2;
    renderCafe();
  }
  function cafeSubmit() {
    ensureHeard();
    const id = context.lessonId, next2 = submitCafeOrder(cafeRun), p = getProgress(), q = cafeQuestion(0, id);
    speech.stop();
    if (!p.lessonState(id).answers[q.id]) p.recordAnswer({ lessonId: id, questionId: q.id, choiceId: next2.choiceId, correct: next2.choiceId === q.answerId, helped, order: cafeRun.order, input: cafeRun.listen, stage: cafeStage(next2) });
    else p.setStage(id, cafeStage(next2));
    cafeRun = next2;
    renderCafe();
  }
  async function cafeSpeech() {
    if (!speech.available() && !await speech.prepare()) throw Error("\uC9C8\uBB38 \uC18C\uB9AC\uB97C \uC900\uBE44\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB2E4\uC2DC \uC900\uBE44\uD558\uAC70\uB098 \uAE00\uC790 \uB3C4\uC6C0\uC744 \uC5F4\uC5B4 \uC8FC\uC138\uC694.");
    const state = speech.metrics();
    if (state.phase === "playing") {
      speech.pause();
      return;
    }
    const id = context.lessonId, step = cafeRun.step, lineId = `${id}-${step + 1}`;
    await speech.play(lineId, () => {
      if (ended || !shown || context?.phase !== "cafe" || context.lessonId !== id || cafeRun.step !== step) return;
      try {
        cafeRun = { ...cafeRun, listen: { ...cafeRun.listen, heard: true } };
        persistCafe();
        renderCafe();
      } catch {
        speech.stop();
      }
    });
  }
  function cafeNext() {
    speech.stop();
    const next2 = advanceCafe(cafeRun, context.lessonId);
    helped = false;
    getProgress().setStage(context.lessonId, cafeStage(next2));
    cafeRun = next2;
    if (next2.phase === "complete") finishCafe();
    else renderCafe();
  }
  function finishCafe() {
    const p = getProgress();
    p.finishLesson(context.lessonId);
    context.phase = "complete";
    context.questionIndex = 3;
    const nextId = CAFE_LESSON_IDS.find((id) => p.lessonState(id).status !== "completed"), nextLesson = nextId ? lessonById(nextId) : packById("cafe").lessons.find((l) => p.lessonState(l.id).status !== "completed");
    paint("\uC624\uB298\uC758 \uCE74\uD398, \uC798 \uB2E4\uB140\uC654\uC5B4\uC694", cafeCompletionMarkup({ photo, nextLesson, lessonId: context.lessonId, state: cafeRun }), { type: "life-cafe-complete", focus: ".cafe-focus", eyebrow: "LIFE IN KOREA \xB7 CAFE" });
    const ticket = generation;
    p.flush().catch(() => {
      if (shown && ticket === generation) home.toast("\uCE74\uD398 \uAE30\uB85D\uC744 \uC800\uC7A5\uD558\uACE0 \uC788\uC5B4\uC694. \uD654\uBA74\uC758 \uC9C4\uD589\uC740 \uC720\uC9C0\uB3FC\uC694.");
    });
  }
  function persistStage() {
    const p = getProgress();
    if (context) p.setStage(context.lessonId, { phase: context.phase, sceneIndex: context.sceneIndex, questionIndex: context.questionIndex, helped });
  }
  function lessonHeader(l) {
    const pack2 = packById(l.packId);
    return `<div class="life-session-meta" data-life-session="${escape(getProgress().lessonState(l.id).attemptId)}" data-life-lesson-id="${l.id}" data-life-phase="${context.phase}" data-life-step="${context.questionIndex}"><span>${escape(pack2.title)} \xB7 ${phaseNames[l.type]}</span><span>${context.phase === "questions" ? `${Math.min(context.questionIndex + 1, l.questions.length)} / ${l.questions.length}` : "\uCE5C\uAD6C\uC640 \uC900\uBE44\uD558\uAE30"}</span></div>`;
  }
  function renderLesson() {
    if (!context) return;
    const l = lessonById(context.lessonId);
    if (!l) return;
    const header = lessonHeader(l);
    if (context.phase === "intro") {
      const scene2 = l.scenes[0];
      paint(l.title, `${header}<div class="life-intro"><div class="life-heading" tabindex="-1">${photo("mongle", "life-intro-friend")}<p class="life-goal">${escape(l.goal)}</p><p>\uC77D\uACE0 \uACE0\uB974\uB294 \uAE30\uCD08 \uC0DD\uD65C \uD55C\uAD6D\uC5B4</p></div><div class="life-expression-list">${l.expressions.map((e) => `<article><strong>${escape(e.korean)}</strong><p>${escape(e.meaning)}</p></article>`).join("")}</div></div><div class="life-actions"><button class="felt-button" data-life-begin>${l.type === "story" ? "\uC774\uC57C\uAE30 \uC77D\uAE30" : "\uCE5C\uAD6C\uC640 \uC2DC\uC791\uD558\uAE30"} <span aria-hidden="true">\u2192</span></button><button class="quiet-button" data-life-pause>\uB9C8\uB8E8\uC5D0\uC11C \uC7A0\uAE50 \uC26C\uAE30</button></div>`, { type: "life-lesson" });
      return;
    }
    if (context.phase === "story") {
      const scene2 = l.scenes[context.sceneIndex];
      if (!scene2) {
        context.phase = "questions";
        persistStage();
        renderLesson();
        return;
      }
      const friend = friends[scene2.speaker];
      paint(l.title, `${header}<div class="life-story-stage"><div class="life-cast">${Object.keys(friends).map((f) => `<div class="${f === scene2.speaker ? "is-speaking" : ""}">${photo(f)}<small>${friends[f].name}</small></div>`).join("")}</div><div class="life-dialogue life-heading" tabindex="-1"><small>${friend ? friend.name : "\uC774\uC57C\uAE30"}</small><p>${escape(scene2.text)}</p></div></div><div class="life-story-position">${context.sceneIndex + 1} / ${l.scenes.length} \uC7A5\uBA74</div><div class="life-actions"><button class="felt-button" data-life-scene-next>${context.sceneIndex + 1 === l.scenes.length ? "\uC774\uC81C \uB0B4\uAC00 \uACE8\uB77C \uBCFC\uAC8C\uC694" : "\uB2E4\uC74C \uC7A5\uBA74"} <span aria-hidden="true">\u2192</span></button><button class="quiet-button" data-life-pause>\uC774\uC57C\uAE30 \uC800\uC7A5\uD558\uACE0 \uC26C\uAE30</button></div>`, { type: "life-story" });
      return;
    }
    renderQuestion();
  }
  function renderQuestion() {
    const l = lessonById(context.lessonId), q = l.questions[context.questionIndex];
    if (!q) return finish();
    const previous = getProgress().lessonState(l.id).answers[q.id];
    if (previous && !lastFeedback) lastFeedback = { correct: previous.correct, choiceId: previous.choiceId, question: q, helped: previous.helped };
    paint(l.title, `${lessonHeader(l)}${questionMarkup(q, lastFeedback, { lesson: l })}`, { type: "life-question", focus: ".life-question-title" });
  }
  function questionMarkup(q, feedback, { lesson: lesson2 = null, reviewIndex = 0, reviewTotal = 0 } = {}) {
    const choiceButtons = q.choices.map((c) => `<button class="life-choice ${feedback && c.id === feedback.choiceId ? "is-chosen" : ""} ${feedback && c.id === q.answerId ? "is-correct" : ""}" data-life-choice="${c.id}" ${feedback ? "disabled" : ""}><span>${escape(c.text)}</span></button>`).join("");
    return `<div class="life-question-layout"><section class="life-question-copy"><div class="life-question-title" tabindex="-1"><small>${lesson2 ? "\uC77D\uACE0 \uC0C1\uD669\uC5D0 \uB9DE\uAC8C \uACE8\uB77C\uC694" : `\uB2E4\uB978 \uC7A5\uBA74\uC5D0\uC11C \uB2E4\uC2DC \uB9CC\uB098\uC694 \xB7 ${reviewIndex + 1} / ${reviewTotal}`}</small><h3>${escape(q.prompt)}</h3></div><p class="life-context">${escape(q.context || "")}</p><button class="quiet-button life-help" data-life-help ${feedback ? "disabled" : ""}>\uD45C\uD604 \uB3C4\uC6C0 \uBCF4\uAE30</button><p class="life-hint" ${helped ? "" : "hidden"}>${escape(q.explanation)}</p></section><section class="life-answer-area" aria-label="\uB2F5 \uACE0\uB974\uAE30"><div class="life-choices">${choiceButtons}</div>${feedback ? `<div class="life-feedback" role="status"><strong>${feedback.correct && !feedback.helped ? "\uC798 \uACE8\uB790\uC5B4\uC694." : "\uD568\uAED8 \uD655\uC778\uD574\uC694."}</strong><p>${escape(q.explanation)}</p>${!feedback.correct || feedback.helped ? "<small>\uC774 \uD45C\uD604\uC740 \uC7A0\uC2DC \uB4A4 \uC0C8 \uC0C1\uD669\uC5D0\uC11C \uB2E4\uC2DC \uB9CC\uB098\uC694.</small>" + retryButton(q) : ""}</div>` : ""}</section></div><div class="life-actions"><button class="felt-button" data-life-question-next ${feedback ? "" : "disabled"}>${feedback ? "\uB2E4\uC74C\uC73C\uB85C" : "\uB2F5\uC744 \uACE8\uB77C \uC8FC\uC138\uC694"} <span aria-hidden="true">\u2192</span></button><button class="quiet-button" data-life-pause>\uC9C4\uB3C4 \uC800\uC7A5\uD558\uACE0 \uC26C\uAE30</button></div>`;
  }
  function choose(choiceId) {
    if (lastFeedback) return;
    const p = getProgress(), l = lessonById(context.lessonId), q = l.questions[context.questionIndex];
    const correct = choiceId === q.answerId;
    p.recordAnswer({ lessonId: l.id, questionId: q.id, choiceId, correct, helped });
    lastFeedback = { question: q, choiceId, correct, helped };
    renderQuestion();
  }
  function finish() {
    const p = getProgress(), l = lessonById(context.lessonId);
    p.finishLesson(l.id);
    const s = summary(), done = p.lessonState(l.id), right = Object.values(done.answers).filter((a) => a.correct && !a.helped).length;
    context.phase = "complete";
    const pack2 = packById(l.packId), packDone = s.packs.find((x) => x.id === pack2.id), nextLesson = s.nextLesson;
    paint("\uC791\uC740 \uD55C \uAC78\uC74C\uC774 \uC313\uC600\uC5B4\uC694", `<div class="life-complete life-heading" tabindex="-1"><div class="life-cast">${Object.keys(friends).map((f) => photo(f)).join("")}</div><h3>${escape(l.title)}</h3><p>${escape(pack2.title)} \xB7 ${packDone.completed} / ${packDone.total} \uB2E8\uACC4 \uC644\uB8CC</p><p class="life-complete-score">\uCC98\uC74C\uC5D0 \uB3C4\uC6C0 \uC5C6\uC774 \uACE0\uB978 \uB2F5 ${right} / ${l.questions.length}</p>${packDone.completed === packDone.total ? '<p class="life-pack-stamp">\uC774 \uC0DD\uD65C \uD329\uC744 \uC218\uC9D1\uCCA9\uC5D0 \uC644\uC131\uD588\uC5B4\uC694.</p>' : ""}<p>\uBC30\uC6B4 \uD45C\uD604\uC740 \uBCF5\uC2B5 \uC77C\uC815\uC5D0 \uB0A8\uACA8 \uB450\uC5C8\uC5B4\uC694.</p></div><div class="life-actions"><button class="felt-button" ${nextLesson ? `data-life-lesson="${nextLesson.id}"` : "data-life-packs"}>${nextLesson ? `${phaseNames[nextLesson.type]}\uB85C \uC774\uC5B4\uAC00\uAE30` : "\uC0DD\uD65C \uD329 \uBAA8\uB450 \uBCF4\uAE30"} <span aria-hidden="true">\u2192</span></button><button class="plain-button" data-life-review>\uBCF5\uC2B5 \uC77C\uC815 \uBCF4\uAE30</button><button class="quiet-button" data-life-home>\uB9C8\uB8E8\uB85C \uB3CC\uC544\uAC00\uAE30</button></div>`, { type: "life-complete" });
    const ticket = generation;
    p.flush().catch(() => {
      if (shown && ticket === generation) home.toast("\uC9C4\uB3C4 \uC800\uC7A5\uC744 \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC5B4\uC694. \uBCF5\uC2B5 \uC77C\uC815\uC740 \uD654\uBA74\uC5D0 \uB0A8\uACA8 \uB450\uC5C8\uC5B4\uC694.");
    });
  }
  function review() {
    if (!ensureReadable()) return;
    place = "life";
    context = null;
    lastFeedback = null;
    helped = false;
    reviewRun = null;
    const s = summary(), future = Number.isFinite(s.nextReviewAt) ? dayLabel(s.nextReviewAt) : "";
    paint("\uC624\uB298 \uB3CC\uC544\uC628 \uD45C\uD604", `<div class="life-review-summary life-heading" tabindex="-1">${photo("kkamong", "life-intro-friend")}<h3>${s.dueCount ? `${s.dueCount}\uAC1C\uC758 \uD45C\uD604\uC774 \uAE30\uB2E4\uB824\uC694.` : future ? "\uBC30\uC6B4 \uD45C\uD604\uC774 \uC798 \uC26C\uACE0 \uC788\uC5B4\uC694." : "\uCCAB \uD45C\uD604\uC744 \uB9CC\uB098\uB7EC \uAC08\uAE4C\uC694?"}</h3><p>${s.dueCount ? "\uAC19\uC740 \uB2F5\uC744 \uC678\uC6B0\uB294 \uB300\uC2E0, \uC0C8\uB85C\uC6B4 \uC0DD\uD65C \uC7A5\uBA74\uC5D0\uC11C \uACE8\uB77C\uC694." : future ? `\uB2E4\uC74C \uBCF5\uC2B5\uC740 ${escape(future)}\uBD80\uD130 \uC5F4\uB824\uC694.` : "\uC0DD\uD65C \uD329\uC744 \uB9C8\uCE58\uBA74 \uB098\uC5D0\uAC8C \uD544\uC694\uD55C \uBCF5\uC2B5\uC774 \uC0DD\uACA8\uC694."}</p></div>${s.dueCount ? `<div class="life-review-topics">${s.dueReviews.map((r) => `<span>${escape(packById(r.packId)?.title || "\uC0DD\uD65C \uD55C\uAD6D\uC5B4")}</span>`).join("")}</div>` : ""}<div class="life-actions">${s.dueCount ? '<button class="felt-button" data-life-review-start>\uB3CC\uC544\uC628 \uD45C\uD604 \uC5F0\uC2B5\uD558\uAE30 <span aria-hidden="true">\u2192</span></button>' : ""}<button class="plain-button" data-life-next>\uB2E4\uC74C \uD559\uC2B5 \uC774\uC5B4 \uD558\uAE30</button><button class="quiet-button" data-life-home>\uB9C8\uB8E8\uB85C \uB3CC\uC544\uAC00\uAE30</button></div>`, { type: "life-review" });
  }
  function reviewStart() {
    const p = getProgress();
    reviewRun = p.startReview(6);
    if (!reviewRun) return review();
    for (const id of reviewRun.ids) if (exposedTransfers.has(id) && !reviewRun.answers[id]) p.markReviewHelp(id);
    lastFeedback = null;
    helped = false;
    renderReview();
  }
  function renderReview() {
    const run = getProgress().exportSnapshot().activeReview;
    if (!run) return review();
    reviewRun = run;
    const index = run.ids.findIndex((id2) => !run.answers[id2]);
    if (index < 0) {
      const s = summary();
      paint("\uC624\uB298\uC758 \uBCF5\uC2B5\uC744 \uB9C8\uCCE4\uC5B4\uC694", `<div class="life-complete life-heading" tabindex="-1">${photo("mongle", "life-intro-friend")}<h3>${run.ids.length}\uAC1C \uD45C\uD604\uC744 \uB2E4\uC2DC \uB9CC\uB0AC\uC5B4\uC694.</h3><p>\uC798 \uC775\uD78C \uD45C\uD604\uC740 \uB354 \uAE34 \uAC04\uACA9\uC73C\uB85C,<br>\uC5B4\uB824\uC6B4 \uD45C\uD604\uC740 \uC7A0\uC2DC \uB4A4 \uB2E4\uC2DC \uB3CC\uC544\uC640\uC694.</p></div><div class="life-actions"><button class="felt-button" data-life-next>\uB2E4\uC74C \uD559\uC2B5 \uC774\uC5B4 \uD558\uAE30 <span aria-hidden="true">\u2192</span></button><button class="quiet-button" data-life-home>\uB9C8\uB8E8\uB85C \uB3CC\uC544\uAC00\uAE30</button></div>`, { type: "life-review-complete" });
      return;
    }
    const id = run.ids[index], record = getProgress().exportSnapshot().reviews[id], l = lessonById(record.lessonId), original = l.questions.find((q2) => q2.id === record.questionId), q = original.review;
    if (!lastFeedback) helped = run.pendingHelp?.[id] === true;
    context = { lessonId: l.id, phase: "review", questionIndex: index, reviewId: id, reviewQuestion: q };
    paint("\uB2E4\uB978 \uC7A5\uBA74\uC5D0\uC11C \uB2E4\uC2DC \uB9CC\uB098\uC694", `<div class="life-session-meta" data-life-review-id="${escape(id)}" data-life-phase="review" data-life-step="${index}"><span>${escape(packById(record.packId).title)}</span><span>${index + 1} / ${run.ids.length}</span></div>${questionMarkup(q, lastFeedback, { reviewIndex: index, reviewTotal: run.ids.length })}`, { type: "life-question", focus: ".life-question-title" });
  }
  function chooseReview(id) {
    if (lastFeedback) return;
    const q = context.reviewQuestion, p = getProgress();
    p.answerReview({ id: context.reviewId, runId: reviewRun.id, correct: id === q.answerId, helped });
    helped = p.exportSnapshot().activeReview.answers[context.reviewId].helped;
    lastFeedback = { question: q, choiceId: id, correct: id === q.answerId, helped };
    const html = questionMarkup(q, lastFeedback, { reviewIndex: context.questionIndex, reviewTotal: reviewRun.ids.length });
    paint("\uB2E4\uB978 \uC7A5\uBA74\uC5D0\uC11C \uB2E4\uC2DC \uB9CC\uB098\uC694", `<div class="life-session-meta" data-life-review-id="${context.reviewId}" data-life-phase="review" data-life-step="${context.questionIndex}"><span>\uD45C\uD604 \uBCF5\uC2B5</span><span>${context.questionIndex + 1} / ${reviewRun.ids.length}</span></div>${html}`, { type: "life-question", focus: ".life-question-title" });
  }
  function pause() {
    if (context?.phase === "cafe") persistCafe();
    else if (context && ["intro", "story", "questions"].includes(context.phase)) persistStage();
    home.closePanel();
    updateHome();
    home.toast("\uD558\uB358 \uC790\uB9AC\uC640 \uBCF5\uC2B5 \uC77C\uC815\uC744 \uB0A8\uACBC\uC5B4\uC694.");
  }
  const handlers = {
    packs,
    stories,
    review,
    next,
    home: () => {
      home.closePanel();
      updateHome();
    },
    pack: (el) => pack(el.dataset.lifePack),
    lesson: (el) => start(el.dataset.lifeLesson),
    begin: () => {
      context.phase = "story";
      context.sceneIndex = 0;
      persistStage();
      renderLesson();
    },
    "scene-next": () => {
      context.sceneIndex++;
      if (context.sceneIndex >= lessonById(context.lessonId).scenes.length) context.phase = "questions";
      persistStage();
      renderLesson();
    },
    choice: (el) => context.phase === "review" ? chooseReview(el.dataset.lifeChoice) : choose(el.dataset.lifeChoice),
    "question-next": () => {
      if (context.phase === "review") {
        lastFeedback = null;
        helped = false;
        renderReview();
      } else {
        context.questionIndex++;
        lastFeedback = null;
        helped = false;
        persistStage();
        renderLesson();
      }
    },
    "review-start": reviewStart,
    pause,
    "cafe-choice": (el) => cafeChoose(el.dataset.lifeCafeChoice),
    "cafe-next": cafeNext,
    "cafe-word": (el) => {
      const field = el.dataset.lifeCafeWord, value = field === "count" ? Number(el.dataset.cafeValue) : el.dataset.cafeValue;
      cafeRun = updateCafeOrder(cafeRun, field, value);
      persistCafe();
      renderCafe();
      content.querySelector(`[data-life-cafe-word="${field}"][data-cafe-value="${value}"]`)?.focus({ preventScroll: true });
    },
    "cafe-submit": cafeSubmit,
    "cafe-speech": () => {
      void cafeSpeech().catch((error) => home.toast(error.message));
    },
    "cafe-mode": (el) => {
      if (cafeRun.phase !== "welcome") return;
      cafeRun = { ...cafeRun, listen: { mode: el.dataset.lifeCafeMode, heard: false, textShown: false } };
      persistCafe();
      renderCafe();
    },
    "cafe-transcript": () => {
      cafeRun = { ...cafeRun, listen: { ...cafeRun.listen, textShown: true } };
      helped = true;
      persistCafe();
      renderCafe();
      content.querySelector("[data-life-cafe-transcript]")?.focus({ preventScroll: true });
    },
    "cafe-seat": (el) => {
      const next2 = chooseCafeSeat(cafeRun, el.dataset.lifeCafeSeat, context.lessonId);
      getProgress().setStage(context.lessonId, cafeStage(next2));
      cafeRun = next2;
      renderCafe();
    },
    "cafe-help": () => {
      helped = true;
      persistCafe();
      renderCafe();
      content.querySelector("[data-life-cafe-help]")?.focus({ preventScroll: true });
    },
    help: tutorHint,
    "tutor-retry": (el) => companion?.openPractice(el.dataset.lifeTutorRetry)
  };
  function click(event) {
    const button = event.target.closest("button");
    if (!button || !panel.open || !shown) return;
    const entry = Object.entries(handlers).find(([key]) => button.hasAttribute("data-life-" + key));
    if (!entry) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      entry[1](button);
    } catch (error) {
      home.toast(error.message || "\uC9C4\uB3C4\uB97C \uD655\uC778\uD55C \uB4A4 \uB2E4\uC2DC \uC2DC\uC791\uD574 \uC8FC\uC138\uC694.");
    }
  }
  document.addEventListener("click", click);
  timer = setInterval(updateHome, 15e3);
  updateHome();
  return { packs, stories, review, next, pack, start, cafe: () => pack("cafe"), summary, refresh: updateHome, metrics: () => ({ shown, lessonId: context?.lessonId || null, phase: context?.phase || null, step: context?.questionIndex ?? null, cafe: isCafeLesson(context?.lessonId) ? cafeRun : null, speech: speech.metrics(), tutor: companion?.metrics() || null, owner: getProgress().owner, progress: getProgress().exportSnapshot() }), dispose() {
    ended = true;
    speech.dispose();
    clearInterval(timer);
    document.removeEventListener("click", click);
    if (shown) home.closePanel();
  } };
}

// experiences/synk-world-app/life-standalone-entry.mjs
function setupLife(home, asset) {
  let ui;
  const progress = createLifeProgress({ owner: "guest", now: () => Date.now(), onChange: () => ui?.refresh() });
  ui = createLifeExperience({ home, getProgress: () => progress, asset });
  window.__synkLife = ui;
  return ui;
}
export {
  setupLife
};
