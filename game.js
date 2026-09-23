// フェーズ2(一部): エサ・成長段階(ヒナ→若い恐竜→大人)・段階ごとのジャンプ力と当たり判定
(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = CONFIG.canvasWidth;
  canvas.height = CONFIG.canvasHeight;

  const groundY = CONFIG.canvasHeight - CONFIG.groundHeight;

  let player;
  let obstacles;
  let foods;
  let distanceMeters;
  let currentSpeed;
  let obstacleTimer;
  let foodTimer;
  let gameOver;

  function currentStage() {
    return CONFIG.stages[player.stageIndex];
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
    };
    obstacles = [];
    foods = [];
    distanceMeters = 0;
    currentSpeed = CONFIG.scrollSpeed;
    obstacleTimer = randomInterval(CONFIG.obstacle);
    foodTimer = randomInterval(CONFIG.food);
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

  function growPlayer() {
    if (player.stageIndex >= CONFIG.stages.length - 1) return;
    player.foodEaten++;
    if (player.foodEaten >= currentStage().foodToGrow) {
      player.stageIndex++;
      player.foodEaten = 0;
      const bottom = player.y + player.height;
      const newStage = currentStage();
      player.width = newStage.width;
      player.height = newStage.height;
      player.y = bottom - newStage.height;
    }
  }

  function update() {
    if (gameOver) return;

    // 距離が進むほど少しずつスクロールが速くなる
    currentSpeed = CONFIG.scrollSpeed + distanceMeters * CONFIG.speedUpPerMeter;
    distanceMeters += currentSpeed * CONFIG.metersPerFrame;

    // プレイヤーの物理演算
    player.vy += CONFIG.gravity;
    player.y += player.vy;
    if (player.y + player.height >= groundY) {
      player.y = groundY - player.height;
      player.vy = 0;
      player.onGround = true;
    }

    // 障害物の生成
    obstacleTimer--;
    if (obstacleTimer <= 0) {
      spawnObstacle();
      obstacleTimer = randomInterval(CONFIG.obstacle);
    }

    // エサの生成
    foodTimer--;
    if (foodTimer <= 0) {
      spawnFood();
      foodTimer = randomInterval(CONFIG.food);
    }

    // 障害物の移動と当たり判定
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      obstacle.x -= currentSpeed;

      if (isColliding(player, obstacle)) {
        gameOver = true;
      }

      if (obstacle.x + obstacle.width < 0) {
        obstacles.splice(i, 1);
      }
    }

    // エサの移動と当たり判定
    for (let i = foods.length - 1; i >= 0; i--) {
      const food = foods[i];
      food.x -= currentSpeed;

      if (isColliding(player, food)) {
        foods.splice(i, 1);
        growPlayer();
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

  function draw() {
    ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // 地面
    ctx.fillStyle = "#999999";
    ctx.fillRect(0, groundY, CONFIG.canvasWidth, CONFIG.groundHeight);

    // プレイヤー
    ctx.fillStyle = currentStage().color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // 障害物
    ctx.fillStyle = CONFIG.obstacle.color;
    obstacles.forEach((o) => ctx.fillRect(o.x, o.y, o.width, o.height));

    // エサ
    ctx.fillStyle = CONFIG.food.color;
    foods.forEach((f) => ctx.fillRect(f.x, f.y, f.width, f.height));

    // 距離表示
    ctx.fillStyle = "#000000";
    ctx.font = "20px monospace";
    ctx.textAlign = "right";
    ctx.fillText(formatDistance(distanceMeters), CONFIG.canvasWidth - 10, 30);

    // 成長段階表示(動作確認用)
    ctx.textAlign = "left";
    ctx.font = "16px monospace";
    const stage = currentStage();
    const progress =
      player.stageIndex >= CONFIG.stages.length - 1
        ? stage.name
        : `${stage.name} (${player.foodEaten}/${stage.foodToGrow})`;
    ctx.fillText(progress, 10, 25);

    if (gameOver) {
      ctx.textAlign = "center";
      ctx.font = "28px monospace";
      ctx.fillText("GAME OVER", CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2 - 10);
      ctx.font = "16px monospace";
      ctx.fillText("タップ / クリック / スペースキーでリトライ", CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2 + 20);
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
