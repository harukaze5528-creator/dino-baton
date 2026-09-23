// フェーズ2: エサ・成長段階(卵→ヒナ→若い恐竜→大人)・産卵と世代交代・若返り・ゲームオーバー
(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = CONFIG.canvasWidth;
  canvas.height = CONFIG.canvasHeight;

  const groundY = CONFIG.canvasHeight - CONFIG.groundHeight;

  let player;
  let obstacles;
  let foods;
  let parents; // 産卵後、後ろに残って画面外へ流れていく親
  let decorations; // 背景に流れる木・岩・草・ビルなどの飾り(種ごとに見た目が変わる)
  let decorTimer;
  let creditLines; // 飛行ステージで流れてくるエンドロールの文字
  let creditTimer;
  let distanceMeters;
  let currentSpeed;
  let obstacleTimer;
  let foodTimer;
  let generationLog;
  let gameOver;

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

  // ニワトリ(最後の種)の、さらに最後の世代かどうか(この世代は通常の成長の代わりに飛行ステージになる)
  function isFinalChickenGeneration(generation) {
    const perSpecies = CONFIG.difficulty.generationsPerSpecies;
    const genInSpecies = (generation - 1) % perSpecies;
    return speciesIndexForGeneration(generation) === CONFIG.species.length - 1 && genInSpecies === perSpecies - 1;
  }

  // プレイヤーの現在の見た目の色(卵だけは種によらず共通、それ以外は種の色)
  function currentColor() {
    const stage = currentStage();
    return stage.isEgg ? stage.color : currentSpecies().color;
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

  // 世代ごとのベース速度(これに成長段階の speedMultiplier を掛けたものが実際のスクロール速度)
  // 1周の中ではstart→maxのカーブを繰り返し、周回(LOOP)するたびにperLoopBonusぶん底上げする
  function genBaseSpeed(generation) {
    const d = CONFIG.difficulty.baseSpeed;
    const cycleLength = CONFIG.difficulty.generationsPerSpecies * CONFIG.species.length;
    const genInLoop = ((generation - 1) % cycleLength) + 1;
    const loop = loopForGeneration(generation);
    const base = Math.min(d.start + (genInLoop - 1) * d.perGeneration, d.max);
    return base + (loop - 1) * d.perLoopBonus;
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
      state: "active", // "active" | "laying" | "flight"(ニワトリ最後の世代の飛行ステージ)
      layPhase: null, // "decel" | "hold" | "meteor" | "accel"
      layPhaseTimer: 0,
      layStartSpeed: 0,
      layTargetSpeed: 0,
      layResult: null, // 停止中に画面中央へ表示する { generation, distance }
      isMeteor: false, // このholdの後に隕石イベントを挟むか
      input: { up: false, down: false, left: false, right: false }, // キーボード/マウスの押しっぱなし状態
      jumping: false,
      jumpHoldFrames: 0,
      crouching: false,
      crouchPulseFrames: 0, // スマホの下スワイプ用の一時的なしゃがみ時間
      wasUp: false, // 飛行中の羽ばたき検出用(前フレームでupが押されていたか)
      flightTimer: 0,
      flightHitFlash: 0, // エンドロールの文字に触れた時の点滅時間
    };
    obstacles = [];
    foods = [];
    parents = [];
    decorations = [];
    creditLines = [];
    creditTimer = 0;
    decorTimer = randomInterval(species.decor);
    distanceMeters = 0;
    currentSpeed = genBaseSpeed(1) * stage.speedMultiplier * species.speedMultiplier;
    obstacleTimer = randomInterval(obstacleIntervalRange(1));
    foodTimer = randomInterval(foodIntervalRange(1));
    generationLog = [];
    gameOver = false;
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
      approachSpeedMultiplier: kind.approachSpeedMultiplier || 1,
    });
  }

  // 飛ぶ敵(flyer)を縦に何羽も並べて壁を作り、1箇所だけ大人でも通れる高さの隙間を空ける
  function spawnFlock(kind) {
    const segmentKind = CONFIG.obstacleKinds.find((k) => k.id === kind.segmentKind);
    const visual = obstacleVisual(segmentKind);
    const birdHeight = visual.height;

    // 一番下(地面際)は gapHeight 分だけ必ず開けておく。しゃがめばどの種・成長段階でも通り抜けられる
    const spanTop = kind.topMargin;
    const gapTop = groundY - kind.gapHeight;
    const x = CONFIG.canvasWidth;

    for (let y = spanTop; y + birdHeight <= gapTop; y += birdHeight) {
      obstacles.push({ kind: kind.id, behavior: "overhead", x, y, width: visual.width, height: birdHeight, color: visual.color });
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

  function spawnDecor() {
    const decor = currentSpecies().decor;
    decorations.push({
      x: CONFIG.canvasWidth,
      y: groundY - decor.height,
      width: decor.width,
      height: decor.height,
      color: decor.color,
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
  }

  function startLaying() {
    // 産卵演出を開始: 親をその場に残し、プレイヤーは卵に切り替わる(孵化はholdフェーズの終わりで起きる)
    const oldSpeciesIndex = speciesIndexForGeneration(player.generation);

    parents.push({
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height,
      color: currentColor(),
    });

    player.layResult = recordGeneration();
    player.generation++;
    player.generationStartDistance = distanceMeters;
    player.stageIndex = 0; // 卵
    player.foodEaten = 0;
    resizeToStage();
    player.vy = 0;
    player.onGround = true;

    // ティラノサウルス(種0)の最後の世代が終わるタイミングだけ、隕石イベントを挟む
    const newSpeciesIndex = speciesIndexForGeneration(player.generation);
    player.isMeteor = oldSpeciesIndex === 0 && newSpeciesIndex === 1;

    player.state = "laying";
    player.layPhase = "decel";
    player.layPhaseTimer = CONFIG.layAnimation.decelFrames;
    player.layStartSpeed = currentSpeed;
  }

  // hold(世代結果の表示)が終わったときの共通処理: 孵化して次の速度まで加速再開する
  // (ニワトリ最後の世代だけは、通常の孵化の代わりに飛行ステージへ入る)
  function finishHold() {
    if (isFinalChickenGeneration(player.generation)) {
      startFlight();
      return;
    }
    hatch();
    player.layTargetSpeed = genBaseSpeed(player.generation) * CONFIG.stages[1].speedMultiplier * currentSpecies().speedMultiplier;
    player.layPhase = "accel";
    player.layPhaseTimer = CONFIG.layAnimation.accelFrames;
  }

  // 飛行ステージ開始: ニワトリの姿(ADULT)のまま、羽ばたきで飛びながらエンドロールを避ける
  function startFlight() {
    player.stageIndex = CONFIG.stages.length - 1; // ADULTの見た目で飛ぶ
    resizeToStage();
    player.vy = 0;
    player.crouching = false;
    player.wasUp = false;
    player.flightTimer = CONFIG.ending.flightDurationFrames;
    player.flightHitFlash = 0;
    player.state = "flight";
    player.layPhase = null;
    creditLines = [];
    creditTimer = randomInterval(CONFIG.ending.creditInterval);
    currentSpeed = CONFIG.ending.flightSpeed;
  }

  // 飛行中の入力処理: 羽ばたき(upを押した瞬間だけ上向きの力)と左右移動
  function handleFlightInput() {
    if (player.input.left) player.x -= CONFIG.player.moveSpeed;
    if (player.input.right) player.x += CONFIG.player.moveSpeed;
    player.x = clamp(player.x, CONFIG.player.minX, CONFIG.player.maxX);

    if (player.input.up && !player.wasUp) {
      player.vy = -CONFIG.ending.flapPower;
    }
    player.wasUp = player.input.up;
  }

  function spawnCreditLine() {
    const lines = CONFIG.ending.creditLines;
    const text = lines[Math.floor(Math.random() * lines.length)];
    ctx.font = `${CONFIG.ending.creditLineHeight}px monospace`;
    const width = ctx.measureText(text).width;
    const y = 30 + Math.random() * (groundY - 60 - CONFIG.ending.creditLineHeight);
    creditLines.push({ text, x: CONFIG.canvasWidth, y, width, height: CONFIG.ending.creditLineHeight });
  }

  function updateFlight() {
    handleFlightInput();

    player.vy += CONFIG.ending.gravity;
    player.y += player.vy;
    const minY = 10;
    const maxY = groundY - player.height;
    if (player.y < minY) {
      player.y = minY;
      player.vy = 0;
    } else if (player.y > maxY) {
      player.y = maxY;
      player.vy = 0;
    }

    if (player.flightHitFlash > 0) player.flightHitFlash--;

    // エンドロールの生成と移動・当たり判定(当たってもダメージはなく、点滅して知らせるだけ)
    creditTimer--;
    if (creditTimer <= 0) {
      spawnCreditLine();
      creditTimer = randomInterval(CONFIG.ending.creditInterval);
    }
    for (let i = creditLines.length - 1; i >= 0; i--) {
      const line = creditLines[i];
      line.x -= currentSpeed;
      if (player.flightHitFlash <= 0 && isColliding(player, line)) {
        player.flightHitFlash = CONFIG.ending.hitFlashFrames;
      }
      if (line.x + line.width < 0) {
        creditLines.splice(i, 1);
      }
    }

    player.flightTimer--;
    if (player.flightTimer <= 0) {
      player.y = groundY - player.height; // 産卵のため地面に降りる
      startLaying(); // 先祖返り: 卵を産んで次のLOOPのティラノサウルスへ
    }
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
        if (player.isMeteor) {
          const m = CONFIG.meteorEvent;
          player.layPhase = "meteor";
          player.layPhaseTimer = m.fallFrames + m.flashFrames;
        } else {
          finishHold();
        }
      }
    } else if (player.layPhase === "meteor") {
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

    if (player.stageIndex === 1) {
      // ヒナで被弾 → 血筋が途絶える
      gameOver = true;
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
    if (gameOver) return;

    if (player.invulnFrames > 0) player.invulnFrames--;

    if (player.state === "laying") {
      updateLaying(); // このフレームの currentSpeed を決める(減速→停止→加速)
    } else if (player.state === "flight") {
      currentSpeed = CONFIG.ending.flightSpeed; // 飛行中は固定速度
    } else {
      // 時間経過では加速しない。速度は「世代のベース速度 × 成長段階の倍率 × 種の倍率」で決まる
      currentSpeed = genBaseSpeed(player.generation) * currentStage().speedMultiplier * currentSpecies().speedMultiplier;
    }
    distanceMeters += currentSpeed * CONFIG.metersPerFrame;

    if (player.state === "active") {
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
    } else if (player.state === "flight") {
      updateFlight();
    }

    // 産卵後に残された親: そのまま左へ流れて画面外へ
    for (let i = parents.length - 1; i >= 0; i--) {
      parents[i].x -= currentSpeed;
      if (parents[i].x + parents[i].width < 0) {
        parents.splice(i, 1);
      }
    }

    // 背景の飾り: 前景よりゆっくり流れる(パララックス)
    for (let i = decorations.length - 1; i >= 0; i--) {
      decorations[i].x -= currentSpeed * CONFIG.backgroundParallax;
      if (decorations[i].x + decorations[i].width < 0) {
        decorations.splice(i, 1);
      }
    }

    // 障害物・エサの生成は演出中(停止中)は止める。背景の飾りは飛行中(ビルの上空)も出し続ける
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
    }

    if (player.state === "active" || player.state === "flight") {
      decorTimer--;
      if (decorTimer <= 0) {
        spawnDecor();
        decorTimer = randomInterval(currentSpecies().decor);
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

    // 背景(種ごとに色を変える)
    ctx.fillStyle = currentSpecies().bgColor;
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // 背景の飾り(木・岩・草・ビルなど。種ごとに見た目が変わる)
    decorations.forEach((d) => {
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x, d.y, d.width, d.height);
    });

    // 地面
    ctx.fillStyle = "#999999";
    ctx.fillRect(0, groundY, CONFIG.canvasWidth, CONFIG.groundHeight);

    // 産卵後に残された親
    parents.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.width, p.height);
    });

    // プレイヤー(無敵中・エンドロールに触れた直後は点滅。しゃがみ中は低い矩形になる)
    const blinking =
      (player.invulnFrames > 0 && Math.floor(player.invulnFrames / 5) % 2 === 0) ||
      (player.flightHitFlash > 0 && Math.floor(player.flightHitFlash / 5) % 2 === 0);
    if (!blinking) {
      const box = playerHitbox();
      ctx.fillStyle = currentColor();
      ctx.fillRect(box.x, box.y, box.width, box.height);
    }

    // 障害物
    obstacles.forEach((o) => {
      ctx.fillStyle = o.color;
      ctx.fillRect(o.x, o.y, o.width, o.height);
    });

    // エサ
    ctx.fillStyle = CONFIG.food.color;
    foods.forEach((f) => ctx.fillRect(f.x, f.y, f.width, f.height));

    // エンドロール(飛行ステージ中に流れてくる文字。避けながら進む)
    ctx.textAlign = "left";
    ctx.font = `${CONFIG.ending.creditLineHeight}px monospace`;
    ctx.fillStyle = "#000000";
    creditLines.forEach((line) => ctx.fillText(line.text, line.x, line.y + line.height));

    // 世代・距離表示
    ctx.fillStyle = "#000000";
    ctx.font = "20px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`GEN ${player.generation} ${formatDistance(distanceMeters)}`, CONFIG.canvasWidth - 10, 30);

    // 周回数(先祖返りするたびに増える)
    ctx.font = "12px monospace";
    ctx.fillText(`LOOP ${loopForGeneration(player.generation)}`, CONFIG.canvasWidth - 10, 44);

    // 成長段階の進捗表示(動作確認用)
    ctx.textAlign = "left";
    ctx.font = "16px monospace";
    const stage = currentStage();
    const speciesName = currentSpecies().name;
    let progress = "";
    if (player.state === "flight") {
      progress = `${speciesName} — FLYING HOME (${Math.ceil(player.flightTimer / 60)}s)`;
    } else if (player.state === "laying") {
      if (player.layPhase === "meteor") progress = "METEOR IMPACT...";
      else if (player.layPhase !== "hold") progress = "Laying egg...";
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
    ctx.font = "14px monospace";
    ctx.fillText(formatYearsAgo(currentYearsAgo()), 10, CONFIG.canvasHeight - 10);

    // 産卵演出: 完全停止中は画面中央にその世代の結果を表示
    if (player.state === "laying" && player.layPhase === "hold" && player.layResult) {
      ctx.textAlign = "center";
      ctx.font = "26px monospace";
      ctx.fillText(
        `GEN ${player.layResult.generation} ${Math.floor(player.layResult.distance)}m`,
        CONFIG.canvasWidth / 2,
        CONFIG.canvasHeight / 2
      );
    }

    // 隕石イベント: 右上から隕石が落ちてきて、着弾すると画面が閃光に包まれる
    if (player.state === "laying" && player.layPhase === "meteor") {
      const m = CONFIG.meteorEvent;
      const elapsed = m.fallFrames + m.flashFrames - player.layPhaseTimer;
      if (elapsed < m.fallFrames) {
        const t = elapsed / m.fallFrames;
        const startX = CONFIG.canvasWidth - 40;
        const startY = 0;
        const endX = CONFIG.canvasWidth / 2;
        const endY = groundY;
        ctx.fillStyle = m.color;
        ctx.fillRect(startX + (endX - startX) * t, startY + (endY - startY) * t, 20, 20);
      } else {
        ctx.fillStyle = m.flashColor;
        ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
      }
    }

    if (gameOver) {
      ctx.textAlign = "center";
      ctx.font = "28px monospace";
      ctx.fillText("GAME OVER", CONFIG.canvasWidth / 2, 90);

      ctx.font = "18px monospace";
      ctx.fillText(`${generationLog.length} GEN  ${formatDistanceComma(distanceMeters)}`, CONFIG.canvasWidth / 2, 125);

      ctx.font = "14px monospace";
      const maxRows = 6;
      const shown = generationLog.slice(-maxRows);
      shown.forEach((g, i) => {
        ctx.fillText(`GEN ${g.generation}: ${Math.floor(g.distance)}m`, CONFIG.canvasWidth / 2, 150 + i * 18);
      });

      ctx.font = "16px monospace";
      ctx.fillText("TAP / CLICK / SPACE TO RETRY", CONFIG.canvasWidth / 2, 150 + shown.length * 18 + 20);
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
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
    if (gameOver) {
      reset();
      return;
    }
    player.input[direction] = true;
  });
  window.addEventListener("keyup", (e) => {
    const direction = KEY_DIRECTION[e.code];
    if (!direction) return;
    player.input[direction] = false;
  });

  canvas.addEventListener("mousedown", () => {
    if (gameOver) {
      reset();
      return;
    }
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
      if (gameOver) {
        reset();
        touchStart = null;
        return;
      }
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
