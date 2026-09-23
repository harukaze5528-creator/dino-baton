// フェーズ1プロトタイプ: 自動スクロール・ジャンプ・障害物・当たり判定・距離表示
(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = CONFIG.canvasWidth;
  canvas.height = CONFIG.canvasHeight;

  const groundY = CONFIG.canvasHeight - CONFIG.groundHeight;

  let player;
  let obstacles;
  let frameCount;
  let distanceMeters;
  let currentSpeed;
  let nextObstacleFrame;
  let gameOver;

  function reset() {
    player = {
      x: CONFIG.player.x,
      y: groundY - CONFIG.player.height,
      width: CONFIG.player.width,
      height: CONFIG.player.height,
      vy: 0,
      onGround: true,
    };
    obstacles = [];
    frameCount = 0;
    distanceMeters = 0;
    currentSpeed = CONFIG.scrollSpeed;
    nextObstacleFrame = randomInterval();
    gameOver = false;
  }

  function randomInterval() {
    const { minInterval, maxInterval } = CONFIG.obstacle;
    return minInterval + Math.random() * (maxInterval - minInterval);
  }

  function jump() {
    if (gameOver) {
      reset();
      return;
    }
    if (player.onGround) {
      player.vy = -CONFIG.jumpPower;
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

  function isColliding(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function update() {
    if (gameOver) return;

    frameCount++;

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
    if (frameCount >= nextObstacleFrame) {
      spawnObstacle();
      frameCount = 0;
      nextObstacleFrame = randomInterval();
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
    ctx.fillStyle = CONFIG.player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // 障害物
    ctx.fillStyle = CONFIG.obstacle.color;
    obstacles.forEach((o) => ctx.fillRect(o.x, o.y, o.width, o.height));

    // 距離表示
    ctx.fillStyle = "#000000";
    ctx.font = "20px monospace";
    ctx.textAlign = "right";
    ctx.fillText(formatDistance(distanceMeters), CONFIG.canvasWidth - 10, 30);

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
