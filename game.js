// フェーズ2: エサ・成長段階(卵→ヒナ→若い恐竜→大人)・産卵と世代交代・若返り・ゲームオーバー
(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = CONFIG.canvasWidth;
  canvas.height = CONFIG.canvasHeight;
  // ドット絵を大きい元画像から小さく縮小して描くため、ブラウザ既定の補間(スムージング)を切る。
  // 補間ありだと縮小時ににじんで輪郭が荒く見えるが、切るとくっきりしたドット絵らしい見た目になる
  ctx.imageSmoothingEnabled = false;

  // 画面(特にスマホの横画面)に収まらない時だけ、キャンバス一式(#gameRoot)をCSSの
  // transform:scaleで縮小する。offsetWidth/Heightはtransformの影響を受けないので、
  // 等倍時の実サイズを基準に「画面に収まる倍率」を計算できる。PCなど画面に十分収まる
  // 場合は1倍のまま(これまで通りの見た目)にし、拡大はしない
  const gameRoot = document.getElementById("gameRoot");
  function fitToScreen() {
    const scale = Math.min(window.innerWidth / gameRoot.offsetWidth, window.innerHeight / gameRoot.offsetHeight, 1);
    gameRoot.style.transform = `scale(${scale})`;
  }
  window.addEventListener("resize", fitToScreen);
  window.addEventListener("orientationchange", fitToScreen);
  fitToScreen();
  if (document.fonts) document.fonts.ready.then(fitToScreen); // フォント読み込み完了でボタン幅が変わる分も反映する

  // タッチ操作端末かどうか(タイトル画面でスワイプ操作の案内を出すかどうかの判定に使う)
  const isTouchDevice = navigator.maxTouchPoints > 0 || "ontouchstart" in window;

  const groundY = CONFIG.canvasHeight - CONFIG.groundHeight;

  let player;
  let obstacles;
  let foods;
  let parents; // 産卵後、後ろに残って画面外へ流れていく親
  let clouds; // 空を流れる雲(種によらず共通)
  let cloudTimer;
  let distanceMeters;
  let currentSpeed;
  let obstacleTimer;
  let foodTimer;
  let generationLog;
  let gameOver;
  let retryCooldown; // ゲームオーバー直後、リトライ入力を受け付けない猶予フレーム数(誤操作での即リトライを防ぐ)
  let screen = "title"; // "title" | "playing" (ゲームオーバーはscreen="playing"のままgameOverフラグで表す)
  let paused = false;
  let resultBlinkCounter; // 結果画面でリトライ案内を点滅させるためのカウンタ
  let titleBlinkCounter = 0; // タイトル画面で開始案内を点滅させるためのカウンタ
  let runAnimFrameCounter; // 走りアニメーション(run1.png/run2.png)の経過フレーム数
  let groundScrollX; // 地面模様(groundSprite)のスクロール位置(px)
  let lastParent; // 直近の産卵で残った親(次の世代が孵化した瞬間、骨の姿に切り替える対象)

  // 障害物用のドット絵を読み込んで使い回すキャッシュ(パス文字列 → { img })。
  // imgはロード完了までnullなので、参照した時点でまだ読み込み中でも壊れない
  const imageCache = {};
  function getOrLoadImage(src) {
    if (!src) return null;
    let entry = imageCache[src];
    if (!entry) {
      entry = { img: null };
      const image = new Image();
      image.onload = () => { entry.img = image; };
      image.onerror = () => { entry.img = null; };
      image.src = src;
      imageCache[src] = entry;
    }
    return entry;
  }

  // 効果音: あらかじめ読み込んでおき、鳴らすたびに複製して再生する(短時間に連続で
  // 鳴っても前の再生を止めずに重ねられるようにするため)。ブラウザの自動再生制限で
  // 最初のユーザー操作より前の再生に失敗しても無視する(キー入力等で以後は再生できる)
  const soundElements = {};
  function soundVolume(key) {
    const overrides = CONFIG.sounds.volumes || {};
    return key in overrides ? overrides[key] : CONFIG.sounds.volume;
  }
  Object.keys(CONFIG.sounds).forEach((key) => {
    if (key === "volume" || key === "volumes") return;
    const audio = new Audio(CONFIG.sounds[key]);
    audio.volume = soundVolume(key);
    soundElements[key] = audio;
  });
  function playSound(key) {
    const base = soundElements[key];
    if (!base) return;
    const instance = base.cloneNode();
    instance.volume = soundVolume(key);
    instance.play().catch(() => {});
  }

  // BGM: タイトル画面も含めてループ再生し、一時停止中・結果画面だけ止める。
  // ブラウザの自動再生制限でタイトル表示直後の再生に失敗しても、shouldPlayがtrueの間は
  // 毎フレームbgm.pausedを見て再試行するので、最初のユーザー操作の直後に自然に鳴り出す
  const bgm = new Audio(CONFIG.bgm.src);
  bgm.loop = true;
  bgm.volume = CONFIG.bgm.volume;
  function syncBgm() {
    const shouldPlay = !paused && !gameOver;
    if (shouldPlay && bgm.paused) {
      bgm.play().catch(() => {});
    } else if (!shouldPlay && !bgm.paused) {
      bgm.pause();
    }
  }

  // 地面に重ねて描く模様(線とドット)。スクロールに合わせて横に流れる
  const groundSpriteEntry = getOrLoadImage(CONFIG.groundSprite);

  // エサ(木の実)のドット絵
  const foodSpriteEntry = getOrLoadImage(CONFIG.food.sprite);

  // プレイヤーのドット絵スプライト(卵・ヒナ。種専用の絵がない場合の共通フォールバック)。
  // assets/配下のPNGはあらかじめ背景を透過処理済み(制作ツール側の白いベタ塗り背景を
  // 透明化してある)。ここではgetImageDataなどのピクセル読み取りは一切行わない。
  // 理由: index.htmlをfile://で直接開いた場合、canvasからのピクセル読み取りは
  // ブラウザにセキュリティエラーとしてブロックされるため(ローカルサーバー経由でしか
  // 動かなくなってしまう)。該当ファイルがない/読み込みに失敗した場合はnullのままになり、
  // その段階は今まで通り四角形で描画される
  const playerSpriteFiles = ["assets/egg.png", "assets/chick.png"];
  const playerSprites = playerSpriteFiles.map(() => null);
  playerSpriteFiles.forEach((src, i) => {
    const img = new Image();
    img.onload = () => { playerSprites[i] = img; };
    img.onerror = () => { playerSprites[i] = null; };
    img.src = src;
  });

  // 若い恐竜・大人の段階で、種専用の絵がない場合に使う走りアニメーション用の2枚
  // (run1.png/run2.pngを交互に切り替えて走っているように見せる)
  const runFrameFiles = ["assets/run1.png", "assets/run2.png"];
  const runFrames = runFrameFiles.map(() => null);
  runFrameFiles.forEach((src, i) => {
    const img = new Image();
    img.onload = () => { runFrames[i] = img; };
    img.onerror = () => { runFrames[i] = null; };
    img.src = src;
  });

  // 種専用のドット絵。sprite(CONFIG.species[].sprite)は若い恐竜・大人の段階で使い、
  // chickSprite(CONFIG.species[].chickSprite)はヒナの段階で使う。指定がない種はnullの
  // ままになり、共通のchick.png/走りアニメーションが使われる
  function loadSpeciesSpriteMap(fieldName) {
    const map = {};
    CONFIG.species.forEach((species) => {
      if (!species[fieldName]) return;
      map[species.name] = null;
      const img = new Image();
      img.onload = () => { map[species.name] = img; };
      img.onerror = () => { map[species.name] = null; };
      img.src = species[fieldName];
    });
    return map;
  }
  const speciesSprites = loadSpeciesSpriteMap("sprite");
  const speciesChickSprites = loadSpeciesSpriteMap("chickSprite");
  const speciesFoodSprites = loadSpeciesSpriteMap("foodSprite");
  const speciesSkeletonSprites = loadSpeciesSpriteMap("skeletonSprite");

  // 種専用の走りアニメーション([フレーム1, フレーム2]の2枚)。指定がない種はnullのままになる
  function loadSpeciesRunSpriteMap(fieldName) {
    const map = {};
    CONFIG.species.forEach((species) => {
      if (!species[fieldName]) return;
      const frames = species[fieldName].map(() => null);
      map[species.name] = frames;
      species[fieldName].forEach((src, i) => {
        const img = new Image();
        img.onload = () => { frames[i] = img; };
        img.onerror = () => { frames[i] = null; };
        img.src = src;
      });
    });
    return map;
  }
  // CONFIG.species[].runSprite は若い恐竜・大人の段階で使い、chickRunSpriteはヒナの段階で使う
  const speciesRunSprites = loadSpeciesRunSpriteMap("runSprite");
  const speciesChickRunSprites = loadSpeciesRunSpriteMap("chickRunSprite");

  // 段階と種から描画に使うスプライトを決める。卵は種によらず常に共通の絵。ヒナは種専用の
  // 走りアニメーション(2枚)があればそれを、なければ種専用の静止画、それもなければ汎用の
  // chick.pngを使う。若い恐竜・大人は種専用の走りアニメーション(2枚)があればそれを、
  // なければ種専用の静止画、それもなければ汎用の走りアニメーションを使う
  // (CONFIG.stagesの小さいwidth/heightでそのまま描画されるので若い恐竜は縮小表示になる)
  function spriteFor(stageIndex, species, runFrameIndex) {
    if (stageIndex === 1) {
      const chickRunPair = speciesChickRunSprites[species.name];
      if (chickRunPair) return chickRunPair[runFrameIndex] || chickRunPair[0] || speciesChickSprites[species.name];
      const chickSprite = speciesChickSprites[species.name];
      if (chickSprite) return chickSprite;
      return playerSprites[1];
    }
    if (stageIndex >= 2) {
      const speciesRunPair = speciesRunSprites[species.name];
      if (speciesRunPair) return speciesRunPair[runFrameIndex] || speciesRunPair[0] || speciesSprites[species.name];
      const speciesSprite = speciesSprites[species.name];
      if (speciesSprite) return speciesSprite;
      return runFrames[runFrameIndex] || runFrames[0];
    }
    return playerSprites[stageIndex];
  }

  // 孵化直前の点滅演出用: スプライトの絵をその場で白く染めるための使い回しキャンバス
  const flashScratchCanvas = document.createElement("canvas");
  const flashScratchCtx = flashScratchCanvas.getContext("2d");

  // スプライトがあればそのまま描画し(絵の陰影を活かすため普段は色付けしない)、
  // なければ今まで通り四角形を描画する。flashColorが指定された時だけ、絵の不透明部分を
  // その色で染めて孵化直前の点滅を表現する
  function drawCharacter(sprite, x, y, width, height, color, flashColor) {
    if (sprite) {
      if (flashColor) {
        flashScratchCanvas.width = sprite.naturalWidth;
        flashScratchCanvas.height = sprite.naturalHeight;
        flashScratchCtx.clearRect(0, 0, flashScratchCanvas.width, flashScratchCanvas.height);
        flashScratchCtx.drawImage(sprite, 0, 0);
        flashScratchCtx.globalCompositeOperation = "source-atop";
        flashScratchCtx.fillStyle = flashColor;
        flashScratchCtx.fillRect(0, 0, flashScratchCanvas.width, flashScratchCanvas.height);
        flashScratchCtx.globalCompositeOperation = "source-over";
        ctx.drawImage(flashScratchCanvas, x, y, width, height);
      } else {
        ctx.drawImage(sprite, x, y, width, height);
      }
    } else {
      ctx.fillStyle = flashColor || color;
      ctx.fillRect(x, y, width, height);
    }
  }

  function currentStage() {
    return CONFIG.stages[player.stageIndex];
  }

  // 世代からその時点の種を求める(generationsPerSpecies世代ごとに次の種へ。最後まで行くと最初に戻る)
  function speciesIndexForGeneration(generation) {
    const perSpecies = CONFIG.difficulty.generationsPerSpecies;
    return Math.floor((generation - 1) / perSpecies) % CONFIG.species.length;
  }

  function currentSpecies() {
    return CONFIG.species[speciesIndexForGeneration(player.generation)];
  }

  // 全種を1周するごとに1増える周回数(LOOP)
  function loopForGeneration(generation) {
    const cycleLength = CONFIG.difficulty.generationsPerSpecies * CONFIG.species.length;
    return Math.floor((generation - 1) / cycleLength) + 1;
  }

  // プレイヤーの現在の見た目の色(卵だけは種によらず共通、それ以外は種の色)
  function currentColor() {
    const stage = currentStage();
    return stage.isEgg ? stage.color : currentSpecies().color;
  }

  // 孵化の直前(通常の卵孵化タイマー、または産卵演出のhold明け孵化)かどうか。
  // trueなら残りフレーム数を返し、falseならnullを返す
  function hatchFlashFramesRemaining() {
    const fx = CONFIG.hatchEffect;
    if (currentStage().isEgg && player.state === "active" && player.hatchTimer <= fx.flashFrames) {
      return player.hatchTimer;
    }
    if (player.state === "laying" && player.layPhase === "hold" && player.layPhaseTimer <= fx.flashFrames) {
      return player.layPhaseTimer;
    }
    return null;
  }

  // 画面端に表示する年代(その種の中で世代が進むにつれて yearsAgoStart → yearsAgoEnd へ線形に減っていく)
  function currentYearsAgo() {
    const perSpecies = CONFIG.difficulty.generationsPerSpecies;
    const species = currentSpecies();
    const genInSpecies = (player.generation - 1) % perSpecies;
    const progress = perSpecies > 1 ? genInSpecies / (perSpecies - 1) : 1;
    return species.yearsAgoStart + (species.yearsAgoEnd - species.yearsAgoStart) * progress;
  }

  function formatYearsAgo(years) {
    const rounded = Math.round(years);
    if (rounded <= 0) return "NOW";
    return `${rounded.toLocaleString("en-US")} YEARS AGO`;
  }

  // 画面端に表示する年代の文字列。1周目は「n YEARS AGO」→「NOW」、
  // 先祖返り後(2周目以降)は「NOW」に戻らず「n YEARS LATER」として増え続ける
  function currentYearsLabel() {
    const cycleLength = CONFIG.difficulty.generationsPerSpecies * CONFIG.species.length;
    if (player.generation <= cycleLength) {
      return formatYearsAgo(currentYearsAgo());
    }
    const yearsLater = (player.generation - cycleLength) * CONFIG.yearsLaterPerGeneration;
    return `${yearsLater.toLocaleString("en-US")} YEARS LATER`;
  }

  // 周回(LOOP)ごとのベース速度。1周の中ではずっと一定(世代が1つ進むごとの増減はなし)。
  // 2周目以降は、直前の周回の「大人の最高速度」と新しい周回の「ヒナの速度」がちょうど一致する
  // ように、大人とヒナのspeedMultiplierの比率を毎周回掛けて求める(種のspeedMultiplierは
  // 全種共通なので相殺される)。これを繰り返すと指数的に上がっていくので、maxで頭打ちにする
  function loopBaseSpeed(loop) {
    const d = CONFIG.difficulty.baseSpeed;
    const chickMult = CONFIG.stages[1].speedMultiplier;
    const adultMult = CONFIG.stages[CONFIG.stages.length - 1].speedMultiplier;
    const firstSpeciesMult = CONFIG.species[0].speedMultiplier;
    const lastSpeciesMult = CONFIG.species[CONFIG.species.length - 1].speedMultiplier;
    const ratioPerLoop = (adultMult * lastSpeciesMult) / (chickMult * firstSpeciesMult);
    return Math.min(d.start * Math.pow(ratioPerLoop, loop - 1), d.max);
  }

  // 世代ごとのベース速度(これに成長段階の speedMultiplier を掛けたものが実際のスクロール速度)
  function genBaseSpeed(generation) {
    return loopBaseSpeed(loopForGeneration(generation));
  }

  // 世代が進むほど密になる障害物の出現間隔(フレーム数)
  function obstacleIntervalRange(generation) {
    const d = CONFIG.difficulty.obstacleInterval;
    const dec = (generation - 1) * d.decreasePerGeneration;
    return {
      minInterval: Math.max(d.minStart - dec, d.floor),
      maxInterval: Math.max(d.maxStart - dec, d.floor + 40),
    };
  }

  // 世代が進むほど減っていくエサの出現間隔(フレーム数)
  function foodIntervalRange(generation) {
    const d = CONFIG.difficulty.foodInterval;
    const inc = (generation - 1) * d.increasePerGeneration;
    return {
      minInterval: Math.min(d.minStart + inc, d.ceiling - 40),
      maxInterval: Math.min(d.maxStart + inc, d.ceiling),
    };
  }

  function resizeToStage() {
    const stage = currentStage();
    const sizeMultiplier = currentSpecies().sizeMultiplier;
    const width = stage.width * sizeMultiplier;
    const height = stage.height * sizeMultiplier;
    const bottom = player.y + player.height;
    player.width = width;
    player.height = height;
    player.y = bottom - height;
  }

  function reset() {
    const stage = CONFIG.stages[0];
    const species = CONFIG.species[0];
    const height = stage.height * species.sizeMultiplier;
    player = {
      x: CONFIG.player.x,
      y: groundY - height,
      width: stage.width * species.sizeMultiplier,
      height,
      vy: 0,
      onGround: true,
      stageIndex: 0,
      foodEaten: 0,
      hatchTimer: stage.hatchFrames,
      invulnFrames: 0,
      generation: 1,
      generationStartDistance: 0,
      state: "active", // "active" | "laying"(産卵演出中: 減速→停止→加速の段階)
      layPhase: null, // "decel" | "hold" | "accel"
      layPhaseTimer: 0,
      layStartSpeed: 0,
      layTargetSpeed: 0,
      layResult: null, // 停止中に画面中央へ表示する { generation, distance }
      input: { up: false, down: false, left: false, right: false }, // キーボード/マウスの押しっぱなし状態
      jumping: false,
      jumpHoldFrames: 0,
      crouching: false,
      crouchPulseFrames: 0, // スマホの下スワイプ用の一時的なしゃがみ時間
    };
    obstacles = [];
    foods = [];
    parents = [];
    clouds = [];
    cloudTimer = randomInterval(CONFIG.clouds);
    distanceMeters = 0;
    currentSpeed = genBaseSpeed(1) * stage.speedMultiplier * species.speedMultiplier;
    obstacleTimer = randomInterval(obstacleIntervalRange(1));
    foodTimer = randomInterval(foodIntervalRange(1));
    generationLog = [];
    gameOver = false;
    paused = false;
    retryCooldown = 0;
    resultBlinkCounter = 0;
    runAnimFrameCounter = 0;
    groundScrollX = 0;
    lastParent = null;
    bgm.currentTime = 0; // リトライ時もBGMを最初から鳴らし直す
  }

  // 走りアニメーション(run1.png/run2.png)のうち今どちらを表示するか(0か1)
  function currentRunFrameIndex() {
    return Math.floor(runAnimFrameCounter / CONFIG.runAnimation.framesPerPose) % 2;
  }

  function randomInterval(cfg) {
    return cfg.minInterval + Math.random() * (cfg.maxInterval - cfg.minInterval);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  // ジャンプ開始(基本の高さ)。しゃがみ中や空中では発生しない
  function startJump() {
    if (!player.onGround || player.crouching) return;
    player.vy = -currentStage().jumpPower * currentSpecies().jumpMultiplier;
    player.onGround = false;
    player.jumping = true;
    player.jumpHoldFrames = 0;
    playSound("jump");
  }

  // スマホの下スワイプ: 地上ならしゃがみを一定時間、空中なら一度だけ強く急降下させる
  function triggerCrouchPulse() {
    if (player.onGround) {
      player.crouchPulseFrames = CONFIG.crouch.swipePulseFrames;
    } else {
      player.vy += CONFIG.crouch.fastFallBoost * 3;
    }
  }

  // 毎フレームの入力処理(ジャンプの高さ調整・しゃがみ/急降下・左右移動)
  function handleInput() {
    if (player.input.left) player.x -= CONFIG.player.moveSpeed;
    if (player.input.right) player.x += CONFIG.player.moveSpeed;
    player.x = clamp(player.x, CONFIG.player.minX, CONFIG.player.maxX);

    if (player.crouchPulseFrames > 0) player.crouchPulseFrames--;

    if (player.onGround) {
      player.crouching = player.input.down || player.crouchPulseFrames > 0;
    } else {
      player.crouching = false; // 空中でのしゃがみ姿勢はなし。↓は急降下として扱う
      if (player.input.down) {
        player.vy += CONFIG.crouch.fastFallBoost;
      }
    }

    if (player.input.up && player.onGround && !player.crouching) {
      startJump();
    }

    // 押し続けている間はさらに高く跳べる(長押しでジャンプが伸びる)
    if (player.jumping && player.input.up && player.vy < 0 && player.jumpHoldFrames < CONFIG.jump.holdMaxFrames) {
      player.vy -= CONFIG.jump.holdBoostPerFrame;
      player.jumpHoldFrames++;
    }
    if (player.vy >= 0) player.jumping = false;
  }

  // プレイヤーの当たり判定・描画用の矩形(しゃがみ中は足元基準で低くなる)
  function playerHitbox() {
    if (!player.crouching) return player;
    const height = player.height * CONFIG.crouch.heightRatio;
    return { x: player.x, y: player.y + (player.height - height), width: player.width, height };
  }

  // 世代でまだ解禁されていない種類を除いた中から、重み(weight)に応じてランダムに選ぶ
  function pickObstacleKind() {
    const unlocked = CONFIG.obstacleKinds.filter((k) => k.unlockGeneration <= player.generation);
    const totalWeight = unlocked.reduce((sum, k) => sum + (k.weight || 1), 0);
    let r = Math.random() * totalWeight;
    for (const k of unlocked) {
      r -= k.weight || 1;
      if (r <= 0) return k;
    }
    return unlocked[unlocked.length - 1];
  }

  // 種ごとの見た目の上書き(仕組みはkind共通、見た目だけ時代で変える)
  function obstacleVisual(kind) {
    const overrides = currentSpecies().obstacleVisuals && currentSpecies().obstacleVisuals[kind.id];
    return overrides ? { ...kind, ...overrides } : kind;
  }

  function spawnObstacle() {
    const kind = pickObstacleKind();
    if (kind.behavior === "flock") {
      spawnFlock(kind);
      return;
    }

    const visual = obstacleVisual(kind);
    const width = visual.width;
    const height = visual.height;
    let x;
    let y;

    if (kind.behavior === "chaser") {
      x = -width; // 画面左の外側から後ろを追ってくる
      y = groundY - height;
      playSound("boulder");
    } else if (kind.behavior === "overhead") {
      x = CONFIG.canvasWidth;
      y = groundY - kind.heightAboveGround - height; // 地面から少し浮いた高さ
    } else {
      // pit(針が埋まった地面)も含め、地面の上に乗る形で配置する
      x = CONFIG.canvasWidth;
      y = groundY - height;
    }

    obstacles.push({
      kind: kind.id,
      behavior: kind.behavior,
      x,
      y,
      width,
      height,
      color: visual.color,
      sprite: visual.sprite ? getOrLoadImage(visual.sprite) : null,
      spriteFrames: visual.spriteFrames ? visual.spriteFrames.map(getOrLoadImage) : null,
      approachSpeedMultiplier: kind.approachSpeedMultiplier || 1,
    });
  }

  // 飛ぶ敵(flyer)を縦に何羽も並べて壁を作り、1箇所だけ大人でも通れる高さの隙間を空ける
  function spawnFlock(kind) {
    const segmentKind = CONFIG.obstacleKinds.find((k) => k.id === kind.segmentKind);
    const visual = obstacleVisual(segmentKind);
    const birdHeight = visual.height;
    const sprite = visual.sprite ? getOrLoadImage(visual.sprite) : null;
    const spriteFrames = visual.spriteFrames ? visual.spriteFrames.map(getOrLoadImage) : null;

    // 一番下(地面際)は gapHeight 分だけ必ず開けておく。しゃがめばどの種・成長段階でも通り抜けられる
    const spanTop = kind.topMargin;
    const gapTop = groundY - kind.gapHeight;
    const x = CONFIG.canvasWidth;

    for (let y = spanTop; y + birdHeight <= gapTop; y += birdHeight) {
      obstacles.push({ kind: kind.id, behavior: "overhead", x, y, width: visual.width, height: birdHeight, color: visual.color, sprite, spriteFrames });
    }
  }

  function spawnFood() {
    const [minH, maxH] = CONFIG.food.heightAboveGround;
    const heightAboveGround = minH + Math.random() * (maxH - minH);
    foods.push({
      x: CONFIG.canvasWidth,
      y: groundY - CONFIG.food.height - heightAboveGround,
      width: CONFIG.food.width,
      height: CONFIG.food.height,
    });
  }

  function spawnCloud() {
    const c = CONFIG.clouds;
    clouds.push({
      x: CONFIG.canvasWidth,
      y: c.minY + Math.random() * (c.maxY - c.minY),
      width: c.width,
      height: c.height,
    });
  }

  function isColliding(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function xOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x;
  }

  // 足場(platform)に重なっている間は、その上面をその場の「地面」として扱う
  function playerGroundY() {
    let ground = groundY;
    for (const o of obstacles) {
      if (o.behavior === "platform" && xOverlap(player, o) && o.y < ground) {
        ground = o.y;
      }
    }
    return ground;
  }

  function recordGeneration() {
    const entry = {
      generation: player.generation,
      distance: distanceMeters - player.generationStartDistance,
    };
    generationLog.push(entry);
    return entry;
  }

  function hatch() {
    player.stageIndex = 1; // ヒナ
    player.foodEaten = 0;
    resizeToStage();
    playSound("hatch");
  }

  function startLaying() {
    // 産卵演出を開始: 親をその場に残し、プレイヤーは卵に切り替わる(孵化はholdフェーズの終わりで起きる)
    playSound("lay");

    const newParent = {
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height,
      color: currentColor(),
      sprite: spriteFor(CONFIG.stages.length - 1, currentSpecies(), currentRunFrameIndex()), // 産卵時点(旧世代)の種の見た目を固定で使う
      skeletonSprite: speciesSkeletonSprites[currentSpecies().name], // 次の世代が孵化した瞬間、これに切り替える
      isSkeleton: false,
      pulseFrames: CONFIG.layPulse.frames, // 産んだ直後、一瞬つぶれてから元に戻る演出用
    };
    parents.push(newParent);
    lastParent = newParent; // 孵化のタイミングでこの親だけ骨の姿にする

    player.layResult = recordGeneration();
    player.generation++;
    player.generationStartDistance = distanceMeters;
    player.stageIndex = 0; // 卵
    player.foodEaten = 0;
    resizeToStage();
    player.vy = 0;
    player.onGround = true;

    player.state = "laying";
    player.layPhase = "decel";
    player.layPhaseTimer = CONFIG.layAnimation.decelFrames;
    player.layStartSpeed = currentSpeed;
  }

  // hold(世代結果の表示)が終わったときの共通処理: 孵化して次の速度まで加速再開する
  function finishHold() {
    hatch();
    // 次の世代が生まれた瞬間、残っている親を骨の姿に切り替える(命のバトンが渡った印)
    if (lastParent) {
      lastParent.isSkeleton = true;
      lastParent = null;
    }
    player.layTargetSpeed = genBaseSpeed(player.generation) * CONFIG.stages[1].speedMultiplier * currentSpecies().speedMultiplier;
    player.layPhase = "accel";
    player.layPhaseTimer = CONFIG.layAnimation.accelFrames;
  }

  function updateLaying() {
    const anim = CONFIG.layAnimation;
    player.layPhaseTimer--;

    if (player.layPhase === "decel") {
      currentSpeed = player.layStartSpeed * Math.max(player.layPhaseTimer, 0) / anim.decelFrames;
      if (player.layPhaseTimer <= 0) {
        currentSpeed = 0;
        obstacles = [];
        foods = [];
        player.layPhase = "hold";
        player.layPhaseTimer = anim.holdFrames;
      }
    } else if (player.layPhase === "hold") {
      currentSpeed = 0;
      if (player.layPhaseTimer <= 0) {
        finishHold();
      }
    } else if (player.layPhase === "accel") {
      const progress = 1 - Math.max(player.layPhaseTimer, 0) / anim.accelFrames;
      currentSpeed = player.layTargetSpeed * progress;
      if (player.layPhaseTimer <= 0) {
        currentSpeed = player.layTargetSpeed;
        player.state = "active";
        player.layPhase = null;
        player.layResult = null;
      }
    }
  }

  function advanceStage() {
    player.stageIndex++;
    player.foodEaten = 0;
    resizeToStage();
  }

  function eatFood() {
    const stage = currentStage();
    if (stage.isEgg) return;
    playSound("pickup");
    player.foodEaten++;
    if (player.foodEaten < stage.foodToGrow) return;

    const isAdult = player.stageIndex === CONFIG.stages.length - 1;
    if (isAdult) {
      startLaying();
    } else {
      advanceStage();
    }
  }

  function takeDamage() {
    if (currentStage().isEgg) return; // 卵は無敵
    if (player.invulnFrames > 0) return;

    playSound("damage");

    if (player.stageIndex === 1) {
      // ヒナで被弾 → 血筋が途絶える
      gameOver = true;
      retryCooldown = CONFIG.retryCooldownFrames;
      resultBlinkCounter = 0;
      recordGeneration();
      return;
    }

    // 若返り: 大人→若い恐竜、若い恐竜→ヒナ
    player.stageIndex--;
    player.foodEaten = 0;
    resizeToStage();
    player.invulnFrames = CONFIG.invulnFramesAfterHit;
  }

  function update() {
    if (gameOver) {
      if (retryCooldown > 0) retryCooldown--;
      else resultBlinkCounter++;
      return;
    }

    if (player.invulnFrames > 0) player.invulnFrames--;

    if (player.state === "laying") {
      updateLaying(); // このフレームの currentSpeed を決める(減速→停止→加速)
    } else {
      // 時間経過では加速しない。速度は「世代のベース速度 × 成長段階の倍率 × 種の倍率」で決まる
      currentSpeed = genBaseSpeed(player.generation) * currentStage().speedMultiplier * currentSpecies().speedMultiplier;
    }
    distanceMeters += currentSpeed * CONFIG.metersPerFrame;
    groundScrollX += currentSpeed;

    if (player.state === "active") {
      runAnimFrameCounter++;

      // 卵は孵化タイマーのみ進める(産卵演出中の卵は updateLaying が孵化を管理する)
      if (currentStage().isEgg) {
        player.hatchTimer--;
        if (player.hatchTimer <= 0) hatch();
      } else {
        handleInput();
      }

      // プレイヤーの物理演算(足場に乗っている間はそこが地面になる)
      player.vy += CONFIG.gravity;
      player.y += player.vy;
      player.onGround = false;
      const landingY = playerGroundY();
      if (player.y + player.height >= landingY) {
        player.y = landingY - player.height;
        player.vy = 0;
        player.onGround = true;
      }
    }

    // 産卵後に残された親: そのまま左へ流れて画面外へ(産んだ直後はしばらくつぶれ演出が残る)
    for (let i = parents.length - 1; i >= 0; i--) {
      parents[i].x -= currentSpeed;
      if (parents[i].pulseFrames > 0) parents[i].pulseFrames--;
      if (parents[i].x + parents[i].width < 0) {
        parents.splice(i, 1);
      }
    }

    // 雲: 種によらず共通
    for (let i = clouds.length - 1; i >= 0; i--) {
      clouds[i].x -= currentSpeed * CONFIG.clouds.parallax;
      if (clouds[i].x + clouds[i].width < 0) {
        clouds.splice(i, 1);
      }
    }

    // 障害物・エサ・背景の飾りの生成は演出中(停止中)は止める
    if (player.state === "active") {
      obstacleTimer--;
      if (obstacleTimer <= 0) {
        spawnObstacle();
        obstacleTimer = randomInterval(obstacleIntervalRange(player.generation));
      }

      foodTimer--;
      if (foodTimer <= 0) {
        spawnFood();
        foodTimer = randomInterval(foodIntervalRange(player.generation));
      }

      cloudTimer--;
      if (cloudTimer <= 0) {
        spawnCloud();
        cloudTimer = randomInterval(CONFIG.clouds);
      }
    }

    // 障害物の移動と当たり判定(種類ごとに仕組みが異なる)
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      if (obstacle.behavior === "chaser") {
        obstacle.x += currentSpeed * obstacle.approachSpeedMultiplier; // 後ろから追いついてくる
      } else {
        obstacle.x -= currentSpeed;
      }

      if (player.state === "active" && obstacle.behavior !== "platform") {
        const hit =
          obstacle.behavior === "pit"
            ? player.onGround && xOverlap(player, obstacle) // 穴はジャンプで飛び越えれば当たらない
            : isColliding(playerHitbox(), obstacle);
        if (hit) {
          takeDamage();
          if (gameOver) break;
        }
      }

      const offscreen = obstacle.behavior === "chaser" ? obstacle.x > CONFIG.canvasWidth : obstacle.x + obstacle.width < 0;
      if (offscreen) {
        obstacles.splice(i, 1);
      }
    }

    // エサの移動と当たり判定
    for (let i = foods.length - 1; i >= 0; i--) {
      const food = foods[i];
      food.x -= currentSpeed;

      if (player.state === "active" && isColliding(playerHitbox(), food)) {
        foods.splice(i, 1);
        eatFood();
        continue;
      }

      if (food.x + food.width < 0) {
        foods.splice(i, 1);
      }
    }
  }

  function formatDistance(meters) {
    return String(Math.floor(meters)).padStart(5, "0") + "m";
  }

  function formatDistanceComma(meters) {
    return Math.floor(meters).toLocaleString("en-US") + "m";
  }

  function draw() {
    ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // 背景(全種共通で白。種の違いは装飾・障害物の見た目だけで表現する)
    ctx.fillStyle = CONFIG.skyColor;
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // 雲(種によらず共通。装飾よりさらにゆっくり流れる)
    ctx.fillStyle = CONFIG.clouds.color;
    clouds.forEach((c) => {
      // 3つの矩形を重ねてドット絵風の雲の形にする
      ctx.fillRect(c.x, c.y + c.height * 0.3, c.width, c.height * 0.4);
      ctx.fillRect(c.x + c.width * 0.15, c.y, c.width * 0.4, c.height * 0.7);
      ctx.fillRect(c.x + c.width * 0.5, c.y + c.height * 0.1, c.width * 0.4, c.height * 0.6);
    });

    // 地面(下地の色の上に、模様(線とドット)をスクロールさせながら重ねて描く)
    ctx.fillStyle = CONFIG.groundColor;
    ctx.fillRect(0, groundY, CONFIG.canvasWidth, CONFIG.groundHeight);
    const groundImg = groundSpriteEntry && groundSpriteEntry.img;
    if (groundImg) {
      const tileHeight = CONFIG.groundHeight;
      const tileWidth = groundImg.naturalWidth * (tileHeight / groundImg.naturalHeight);
      // 画像内の「地面の線」がgroundY(実際にキャラ・障害物が乗る高さ)に来るよう、
      // 線より上のでこぼこ部分だけ上にはみ出させて描く
      const lineY = groundY - tileHeight * CONFIG.groundLineRatio;
      const offset = groundScrollX % tileWidth;
      for (let x = -offset; x < CONFIG.canvasWidth; x += tileWidth) {
        ctx.drawImage(groundImg, x, lineY, tileWidth, tileHeight);
      }
    }

    // 産卵後に残された親(産んだ直後は一瞬つぶれてから元の高さに戻る)
    // 親は産卵直前(ADULT)の姿のまま残るので、常にADULTのスプライト(stageIndex 3)を使う
    parents.forEach((p) => {
      let h = p.height;
      let y = p.y;
      if (p.pulseFrames > 0) {
        const t = p.pulseFrames / CONFIG.layPulse.frames; // 1(直後)→0(戻りきる)
        const squash = 1 - (1 - CONFIG.layPulse.squashRatio) * t;
        h = p.height * squash;
        y = p.y + (p.height - h); // 足元の位置は揃えたまま高さだけつぶす
      }
      const sprite = (p.isSkeleton && p.skeletonSprite) || p.sprite;
      drawCharacter(sprite, p.x, y, p.width, h, p.color);
    });

    // プレイヤー(無敵中は点滅。しゃがみ中は低い矩形になる。孵化直前は点滅する)
    const blinking = player.invulnFrames > 0 && Math.floor(player.invulnFrames / 5) % 2 === 0;
    if (!blinking) {
      const box = playerHitbox();
      const hatchTimer = hatchFlashFramesRemaining();
      const fx = CONFIG.hatchEffect;
      const isFlashing = hatchTimer !== null && Math.floor(hatchTimer / fx.flashIntervalFrames) % 2 === 0;
      drawCharacter(spriteFor(player.stageIndex, currentSpecies(), currentRunFrameIndex()), box.x, box.y, box.width, box.height, currentColor(), isFlashing ? fx.flashColor : null);
    }

    // 障害物(ドット絵があればそれを描画し、なければ今まで通り矩形で描画する)
    obstacles.forEach((o) => {
      let sprite = null;
      if (o.spriteFrames) {
        const frame = o.spriteFrames[currentRunFrameIndex()] || o.spriteFrames[0];
        sprite = frame && frame.img;
      } else if (o.sprite) {
        sprite = o.sprite.img;
      }
      if (sprite) {
        ctx.drawImage(sprite, o.x, o.y, o.width, o.height);
      } else {
        ctx.fillStyle = o.color;
        ctx.fillRect(o.x, o.y, o.width, o.height);
      }
    });

    // エサ(木の実。種専用の絵があればそれを、なければ汎用の絵を描画し、それも無理なら矩形で描画する)
    const speciesFoodSprite = speciesFoodSprites[currentSpecies().name];
    const foodImg = speciesFoodSprite || (foodSpriteEntry && foodSpriteEntry.img);
    foods.forEach((f) => {
      if (foodImg) {
        ctx.drawImage(foodImg, f.x, f.y, f.width, f.height);
      } else {
        ctx.fillStyle = CONFIG.food.color;
        ctx.fillRect(f.x, f.y, f.width, f.height);
      }
    });

    // 世代・距離表示
    ctx.fillStyle = "#000000";
    ctx.font = "20px 'NegaTape', monospace";
    ctx.textAlign = "right";
    ctx.fillText(`GEN ${player.generation} ${formatDistance(distanceMeters)}`, CONFIG.canvasWidth - 10, 30);

    // 周回数(先祖返りするたびに増える)
    ctx.font = "12px 'NegaTape', monospace";
    ctx.fillText(`LOOP ${loopForGeneration(player.generation)}`, CONFIG.canvasWidth - 10, 44);

    // 成長段階の進捗表示(動作確認用)
    ctx.textAlign = "left";
    ctx.font = "16px 'NegaTape', monospace";
    const stage = currentStage();
    const speciesName = currentSpecies().name;
    let progress = "";
    if (player.state === "laying") {
      if (player.layPhase !== "hold") progress = "Laying egg...";
    } else if (stage.isEgg) {
      progress = `${speciesName} EGG (hatch in ${Math.ceil(player.hatchTimer / 60)}s)`;
    } else if (player.stageIndex === CONFIG.stages.length - 1) {
      progress = `${speciesName} ${stage.name} (lay egg: ${player.foodEaten}/${stage.foodToGrow})`;
    } else {
      progress = `${speciesName} ${stage.name} (${player.foodEaten}/${stage.foodToGrow})`;
    }
    ctx.fillText(progress, 10, 25);

    // 年代表示(画面端。進むにつれて減っていき、ニワトリで NOW になる)
    ctx.textAlign = "left";
    ctx.font = "14px 'NegaTape', monospace";
    ctx.fillText(currentYearsLabel(), 10, CONFIG.canvasHeight - 10);

    // 産卵演出: 完全停止中は画面中央にその世代の結果を表示
    if (player.state === "laying" && player.layPhase === "hold" && player.layResult) {
      ctx.textAlign = "center";
      ctx.font = "26px 'NegaTape', monospace";
      ctx.fillText(
        `GEN ${player.layResult.generation} ${Math.floor(player.layResult.distance)}m`,
        CONFIG.canvasWidth / 2,
        CONFIG.canvasHeight / 2
      );
    }

    if (gameOver) {
      drawResultScreen();
    }

    if (screen === "title") {
      drawTitleScreen();
    } else if (paused) {
      drawPausedOverlay();
    }
  }

  // 結果画面: 背景を暗く覆い、中央のパネルに世代数・距離・直近の世代ログを表示する
  function drawResultScreen() {
    const r = CONFIG.resultScreen;
    ctx.fillStyle = r.dimColor;
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    const panelWidth = 360;
    const panelHeight = 260;
    const panelX = (CONFIG.canvasWidth - panelWidth) / 2;
    const panelY = 30;

    ctx.fillStyle = r.panelColor;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.strokeStyle = r.panelBorderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    const centerX = CONFIG.canvasWidth / 2;

    ctx.font = "26px 'NegaTape', monospace";
    ctx.fillText("GAME OVER", centerX, panelY + 38);

    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 20, panelY + 52);
    ctx.lineTo(panelX + panelWidth - 20, panelY + 52);
    ctx.stroke();

    // 到達した世代数(GEN)を最も目立つ大きさで強調する
    ctx.font = "11px 'NegaTape', monospace";
    ctx.fillStyle = "#888888";
    ctx.fillText("GENERATION REACHED", centerX, panelY + 70);

    ctx.font = "44px 'NegaTape', monospace";
    ctx.fillStyle = "#000000";
    ctx.fillText(`${generationLog.length}`, centerX, panelY + 110);

    ctx.font = "14px 'NegaTape', monospace";
    ctx.fillText(`${formatDistanceComma(distanceMeters)} TOTAL`, centerX, panelY + 130);

    ctx.font = "11px 'NegaTape', monospace";
    ctx.fillStyle = "#888888";
    ctx.fillText("RECENT GENERATIONS", centerX, panelY + 148);

    ctx.font = "13px 'NegaTape', monospace";
    ctx.fillStyle = "#000000";
    const maxRows = 6;
    const shown = generationLog.slice(-maxRows);
    shown.forEach((g, i) => {
      ctx.fillText(`GEN ${g.generation}: ${Math.floor(g.distance)}m`, centerX, panelY + 166 + i * 13);
    });

    // リトライ操作を受け付け始めたら(retryCooldown経過後)、案内文を点滅させて目立たせる
    const blinkVisible = retryCooldown > 0 || Math.floor(resultBlinkCounter / r.retryBlinkIntervalFrames) % 2 === 0;
    if (blinkVisible) {
      ctx.font = "15px 'NegaTape', monospace";
      ctx.fillText("TAP / CLICK / SPACE TO RETRY", centerX, panelY + panelHeight - 16);
    }
  }

  // タイトル画面: ゲーム名と開始案内を表示する(背後にはリセット直後のゲーム画面が見えている)
  function drawTitleScreen() {
    const t = CONFIG.titleScreen;
    ctx.fillStyle = t.dimColor;
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    const centerX = CONFIG.canvasWidth / 2;
    const centerY = CONFIG.canvasHeight / 2;

    ctx.font = "34px 'NegaTape', monospace";
    ctx.fillText(t.title, centerX, centerY - 30);

    ctx.font = "16px 'NegaTape', monospace";
    ctx.fillText(t.subtitle, centerX, centerY - 4);

    const blinkVisible = Math.floor(titleBlinkCounter / t.startPromptBlinkIntervalFrames) % 2 === 0;
    if (blinkVisible) {
      ctx.font = "15px 'NegaTape', monospace";
      ctx.fillText(t.startPrompt, centerX, centerY + 40);
    }

    // タッチ操作端末では、スワイプ操作(左右移動・しゃがみ)の分かりにくさを補うため案内を出す
    if (isTouchDevice) {
      ctx.font = "12px 'NegaTape', monospace";
      t.touchHint.forEach((line, i) => {
        ctx.fillText(line, centerX, centerY + 70 + i * 16);
      });
    }
  }

  // 一時停止中のオーバーレイ: ゲーム画面はそのまま見えるように、薄く覆うだけにする。
  // 産卵演出の停止中は画面中央に世代結果が表示されるため、それと重ならない位置に
  // 白い帯を敷いてから「PAUSED」を出す
  function drawPausedOverlay() {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    const labelY = 70;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, labelY - 20, CONFIG.canvasWidth, 34);

    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.font = "26px 'NegaTape', monospace";
    ctx.fillText("PAUSED", CONFIG.canvasWidth / 2, labelY);
  }

  function loop() {
    if (screen === "title") titleBlinkCounter++;
    if (screen === "playing" && !paused) update();
    draw();
    syncPauseButton();
    syncShareButton();
    syncTouchControls();
    syncBgm();
    requestAnimationFrame(loop);
  }

  // タイトル画面での最初の操作でゲームを始める
  function startGame() {
    screen = "playing";
    playSound("confirm");
  }

  // リトライ操作: ゲームをリセットしてから、決定音を鳴らす
  function retryGame() {
    reset();
    playSound("confirm");
  }

  // 一時停止ボタン: プレイ中(ゲームオーバーでない)時だけ表示し、押すたびに一時停止/再開を切り替える
  const pauseBtn = document.getElementById("pauseBtn");
  pauseBtn.addEventListener("click", () => {
    if (screen !== "playing" || gameOver) return;
    paused = !paused;
    pauseBtn.textContent = paused ? "▶" : "||";
    playSound("pause");
  });
  function syncPauseButton() {
    const shouldShow = screen === "playing" && !gameOver;
    const display = shouldShow ? "block" : "none";
    if (pauseBtn.style.display !== display) pauseBtn.style.display = display;
  }

  // 結果画面のシェアボタン: ゲームオーバー中だけ表示し、押すとXの投稿画面を新しいタブで開く
  const shareBtn = document.getElementById("shareBtn");
  shareBtn.addEventListener("click", () => {
    const text = `命のバトン恐竜ラン(仮)で${generationLog.length}世代・${Math.floor(distanceMeters)}m 命をつないだ!`;
    const params = new URLSearchParams({ text, hashtags: CONFIG.share.hashtags });
    window.open(`https://twitter.com/intent/tweet?${params.toString()}`, "_blank", "noopener");
  });
  function syncShareButton() {
    const display = gameOver ? "block" : "none";
    if (shareBtn.style.display !== display) {
      shareBtn.style.display = display;
      fitToScreen(); // シェアボタンの表示/非表示で#gameRootの高さが変わるので倍率を計算し直す
    }
  }

  // タッチ操作用の方向ボタン(左端:左右移動、右端:ジャンプ/しゃがみ)。
  // タッチ操作端末で、実際にプレイ中(ゲームオーバーでない)時だけ表示する
  const dirButtons = {
    left: document.getElementById("btnLeft"),
    right: document.getElementById("btnRight"),
    up: document.getElementById("btnUp"),
    down: document.getElementById("btnDown"),
  };
  Object.keys(dirButtons).forEach((direction) => {
    const btn = dirButtons[direction];
    const press = (e) => {
      e.preventDefault();
      if (screen !== "playing" || gameOver || paused) return;
      btn.classList.add("pressed");
      player.input[direction] = true;
    };
    const release = (e) => {
      e.preventDefault();
      btn.classList.remove("pressed");
      player.input[direction] = false;
    };
    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("pointerleave", release);
  });
  function syncTouchControls() {
    const display = isTouchDevice && screen === "playing" && !gameOver ? "block" : "none";
    Object.values(dirButtons).forEach((btn) => {
      if (btn.style.display !== display) btn.style.display = display;
    });
  }

  // 操作: PC(↑/スペース=ジャンプ、↓=しゃがみ/急降下、←→=左右移動)とスマホ(タップ=ジャンプ、スワイプ=上下左右)
  const KEY_DIRECTION = {
    Space: "up",
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };

  window.addEventListener("keydown", (e) => {
    const direction = KEY_DIRECTION[e.code];
    if (!direction) return;
    e.preventDefault();
    if (screen === "title") {
      startGame();
      return;
    }
    if (gameOver) {
      if (retryCooldown <= 0) retryGame();
      return;
    }
    if (paused) return;
    player.input[direction] = true;
  });
  window.addEventListener("keyup", (e) => {
    const direction = KEY_DIRECTION[e.code];
    if (!direction) return;
    player.input[direction] = false;
  });

  canvas.addEventListener("mousedown", () => {
    if (screen === "title") {
      startGame();
      return;
    }
    if (gameOver) {
      if (retryCooldown <= 0) retryGame();
      return;
    }
    if (paused) return;
    player.input.up = true;
  });
  window.addEventListener("mouseup", () => {
    player.input.up = false;
  });

  // タップ=ジャンプ、スワイプ=上下左右(離した瞬間にジェスチャーを判定する)
  let touchStart = null;
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (screen === "title") {
        startGame();
        return;
      }
      if (gameOver) {
        if (retryCooldown <= 0) retryGame();
        touchStart = null;
        return;
      }
      if (paused) return;
      const t = e.changedTouches[0];
      touchStart = { x: t.clientX, y: t.clientY };
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      if (!touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      touchStart = null;
      handleSwipe(dx, dy);
    },
    { passive: false }
  );

  function handleSwipe(dx, dy) {
    if (gameOver || currentStage().isEgg || player.state === "laying") return;
    const threshold = CONFIG.touch.swipeThreshold;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
      startJump(); // タップ(スワイプと呼べるほど動いていない)
      return;
    }
    if (Math.abs(dy) >= Math.abs(dx)) {
      if (dy < 0) startJump();
      else triggerCrouchPulse();
    } else {
      const nudge = CONFIG.touch.moveNudge * (dx > 0 ? 1 : -1);
      player.x = clamp(player.x + nudge, CONFIG.player.minX, CONFIG.player.maxX);
    }
  }

  reset();
  loop();
})();
