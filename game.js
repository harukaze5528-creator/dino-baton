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
  let distanceMeters;
  let currentSpeed;
  let obstacleTimer;
  let foodTimer;
  let generationLog;
  let gameOver;

  function currentStage() {
    return CONFIG.stages[player.stageIndex];
  }

  // 世代ごとのベース速度(これに成長段階の speedMultiplier を掛けたものが実際のスクロール速度)
  function genBaseSpeed(generation) {
    const d = CONFIG.difficulty.baseSpeed;
    return Math.min(d.start + (generation - 1) * d.perGeneration, d.max);
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

  // 段階ごとに必要なエサの数(世代1だけ firstGeneration.foodToGrowMultiplier で短縮する)
  function foodTarget(stage, generation) {
    if (generation === 1) {
      return Math.max(1, Math.round(stage.foodToGrow * CONFIG.difficulty.firstGeneration.foodToGrowMultiplier));
    }
    return stage.foodToGrow;
  }

  function resizeToStage() {
    const stage = currentStage();
    const bottom = player.y + player.height;
    player.width = stage.width;
    player.height = stage.height;
    player.y = bottom - stage.height;
  }

  function reset() {
    const stage = CONFIG.stages[0];
    player = {
      x: CONFIG.player.x,
      y: groundY - stage.height,
      width: stage.width,
      height: stage.height,
      vy: 0,
      onGround: true,
      stageIndex: 0,
      foodEaten: 0,
      hatchTimer: stage.hatchFrames,
      invulnFrames: 0,
      generation: 1,
      generationStartDistance: 0,
      state: "active", // "active" | "laying"(産卵演出中: 減速→停止→加速の3段階)
      layPhase: null, // "decel" | "hold" | "accel"
      layPhaseTimer: 0,
      layStartSpeed: 0,
      layTargetSpeed: 0,
      layResult: null, // 停止中に画面中央へ表示する { generation, distance }
    };
    obstacles = [];
    foods = [];
    parents = [];
    distanceMeters = 0;
    currentSpeed = genBaseSpeed(1) * stage.speedMultiplier;
    obstacleTimer = randomInterval(obstacleIntervalRange(1));
    foodTimer = randomInterval(foodIntervalRange(1));
    generationLog = [];
    gameOver = false;
  }

  function randomInterval(cfg) {
    return cfg.minInterval + Math.random() * (cfg.maxInterval - cfg.minInterval);
  }

  function jump() {
    if (gameOver) {
      reset();
      return;
    }
    if (currentStage().isEgg) return; // 卵は操作不能(孵化を待つだけ)
    if (player.state === "laying") return; // 産卵演出中は操作不能
    if (player.onGround) {
      player.vy = -currentStage().jumpPower;
      player.onGround = false;
    }
  }

  function spawnObstacle() {
    obstacles.push({
      x: CONFIG.canvasWidth,
      y: groundY - CONFIG.obstacle.height,
      width: CONFIG.obstacle.width,
      height: CONFIG.obstacle.height,
    });
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

  function isColliding(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
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
    const adultStage = currentStage();
    parents.push({
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height,
      color: adultStage.color,
    });

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
        hatch();
        // 産卵で次世代のヒナの速度に戻る
        player.layTargetSpeed = genBaseSpeed(player.generation) * CONFIG.stages[1].speedMultiplier;
        player.layPhase = "accel";
        player.layPhaseTimer = anim.accelFrames;
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
    if (player.foodEaten < foodTarget(stage, player.generation)) return;

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
    } else {
      // 時間経過では加速しない。速度は「世代のベース速度 × 成長段階の倍率」で決まる
      currentSpeed = genBaseSpeed(player.generation) * currentStage().speedMultiplier;
    }
    distanceMeters += currentSpeed * CONFIG.metersPerFrame;

    if (player.state === "active") {
      // 卵は孵化タイマーのみ進める(産卵演出中の卵は updateLaying が孵化を管理する)
      if (currentStage().isEgg) {
        player.hatchTimer--;
        if (player.hatchTimer <= 0) hatch();
      }

      // プレイヤーの物理演算
      player.vy += CONFIG.gravity;
      player.y += player.vy;
      if (player.y + player.height >= groundY) {
        player.y = groundY - player.height;
        player.vy = 0;
        player.onGround = true;
      }
    }

    // 産卵後に残された親: そのまま左へ流れて画面外へ
    for (let i = parents.length - 1; i >= 0; i--) {
      parents[i].x -= currentSpeed;
      if (parents[i].x + parents[i].width < 0) {
        parents.splice(i, 1);
      }
    }

    // 障害物・エサの生成は演出中(停止中)は止める
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

    // 障害物の移動と当たり判定
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      obstacle.x -= currentSpeed;

      if (player.state === "active" && isColliding(player, obstacle)) {
        takeDamage();
        if (gameOver) break;
      }

      if (obstacle.x + obstacle.width < 0) {
        obstacles.splice(i, 1);
      }
    }

    // エサの移動と当たり判定
    for (let i = foods.length - 1; i >= 0; i--) {
      const food = foods[i];
      food.x -= currentSpeed;

      if (player.state === "active" && isColliding(player, food)) {
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

    // 地面
    ctx.fillStyle = "#999999";
    ctx.fillRect(0, groundY, CONFIG.canvasWidth, CONFIG.groundHeight);

    // 産卵後に残された親
    parents.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.width, p.height);
    });

    // プレイヤー(無敵中は点滅)
    const blinking = player.invulnFrames > 0 && Math.floor(player.invulnFrames / 5) % 2 === 0;
    if (!blinking) {
      ctx.fillStyle = currentStage().color;
      ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    // 障害物
    ctx.fillStyle = CONFIG.obstacle.color;
    obstacles.forEach((o) => ctx.fillRect(o.x, o.y, o.width, o.height));

    // エサ
    ctx.fillStyle = CONFIG.food.color;
    foods.forEach((f) => ctx.fillRect(f.x, f.y, f.width, f.height));

    // 世代・距離表示
    ctx.fillStyle = "#000000";
    ctx.font = "20px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`GEN ${player.generation} ${formatDistance(distanceMeters)}`, CONFIG.canvasWidth - 10, 30);

    // 成長段階の進捗表示(動作確認用)
    ctx.textAlign = "left";
    ctx.font = "16px monospace";
    const stage = currentStage();
    let progress = "";
    if (player.state === "laying") {
      if (player.layPhase !== "hold") progress = "Laying egg...";
    } else if (stage.isEgg) {
      progress = `${stage.name} (hatch in ${Math.ceil(player.hatchTimer / 60)}s)`;
    } else if (player.stageIndex === CONFIG.stages.length - 1) {
      progress = `${stage.name} (lay egg: ${player.foodEaten}/${foodTarget(stage, player.generation)})`;
    } else {
      progress = `${stage.name} (${player.foodEaten}/${foodTarget(stage, player.generation)})`;
    }
    ctx.fillText(progress, 10, 25);

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

  // 操作: PC(スペースキー / クリック)とスマホ(タップ)
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      jump();
    }
  });
  canvas.addEventListener("mousedown", jump);
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    jump();
  });

  reset();
  loop();
})();
