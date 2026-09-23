// 調整用の数値をまとめる設定ファイル
const CONFIG = {
  canvasWidth: 800,
  canvasHeight: 300,
  groundHeight: 40,
  backgroundParallax: 0.4, // 背景の飾り(木・岩・草・ビルなど)がスクロールに対してどれくらいの速さで流れるか

  // キャラクター(四角形)
  player: {
    x: 80, // 初期位置
    minX: 20, // 左右移動できる範囲
    maxX: 380, // 右端(canvasWidth)ぎりぎりまで行けると障害物の反応時間がなくなるため、少し余裕を残す
    moveSpeed: 4, // 左右キー/スワイプでの移動速度(px/フレーム)
  },
  gravity: 0.6,

  // ジャンプ: ↑/スペース/クリックを押した瞬間に基本の高さで跳び、押し続けるとさらに高く跳べる
  jump: {
    holdBoostPerFrame: 0.35, // 押し続けている間、1フレームごとに追加される上向きの力
    holdMaxFrames: 18, // 追加の力が効く最大フレーム数(これ以上長く押しても変わらない)
  },

  // しゃがみ: ↓を押すと地上ではしゃがみ、空中では急降下する
  crouch: {
    heightRatio: 0.5, // しゃがみ中の高さ(通常時の何倍か。足元基準で低くなる)
    fastFallBoost: 1.2, // 空中で↓を押したときに追加される下向きの力(1フレームごと)
    swipePulseFrames: 20, // スマホの下スワイプでしゃがむ/急降下する時間(フレーム数)
  },

  // スマホのスワイプ操作
  touch: {
    swipeThreshold: 24, // これ以上動かしたらタップではなくスワイプとみなす(px)
    moveNudge: 40, // 左右スワイプ1回で移動する量(px)
  },

  // 成長段階: EGG → CHICK → JUVENILE → ADULT
  // jumpPower が大きいほど高く跳べる。foodToGrow は次の段階に育つ(ADULTは産卵する)までに必要なエサの数
  // (全世代で共通。世代ごとに変えず統一する)
  // EGGだけは isEgg:true で、エサではなく hatchFrames 経過で自動的にCHICKへ孵化する
  // speedMultiplier はスクロール速度の段階別の倍率。ヒナが最も遅く、大人が最も速い
  // (実際の速度 = difficulty.baseSpeed の世代ごとの値 × speedMultiplier。時間経過では加速しない)
  stages: [
    { name: "EGG", isEgg: true, width: 14, height: 14, color: "#cccccc", hatchFrames: 90, speedMultiplier: 0.5 },
    { name: "CHICK", width: 16, height: 20, jumpPower: 12, color: "#333333", foodToGrow: 3, speedMultiplier: 0.7 },
    { name: "JUVENILE", width: 22, height: 27, jumpPower: 11, color: "#333333", foodToGrow: 4, speedMultiplier: 1.0 },
    { name: "ADULT", width: 30, height: 38, jumpPower: 8, color: "#333333", foodToGrow: 5, speedMultiplier: 1.3 },
  ],

  // 世代ごとの難易度カーブ。成長に必要なエサ数(stages[].foodToGrow)は全世代で統一し、
  // その代わりに世代が進むごとにベース速度と障害物密度を上げ、エサの出現頻度を下げていく
  difficulty: {
    // ベース速度(このあと段階ごとの speedMultiplier を掛けたものが実際のスクロール速度になる)
    // 世代を追うごとに少しずつ上がり続け、種が変わっても周回(LOOP)してもリセットしない
    baseSpeed: {
      start: 7, // 世代1のベース速度
      perGeneration: 0.3, // 世代が1つ進むごとに増える量(gen5以降も含め、世代をまたぐたびに効く)
      max: 30, // 上限(実質かなり遠い将来の安全装置)
    },
    // 障害物の出現間隔(フレーム数)。短いほど密度が高い
    obstacleInterval: {
      minStart: 90,
      maxStart: 140,
      decreasePerGeneration: 5,
      floor: 40, // これより短くはしない
    },
    // エサの出現間隔(フレーム数)。長いほどエサが少ない
    foodInterval: {
      minStart: 60,
      maxStart: 100,
      increasePerGeneration: 4,
      ceiling: 160, // これより長くはしない
    },
    generationsPerSpecies: 1, // 何世代ごとに次の種へ移るか
  },

  // 1周目が「NOW」に達したあと(=先祖返り後)は年代表示が「n YEARS LATER」形式に切り替わり、
  // 世代が進むごとに増え続ける(このあとは「YEARS AGO」には戻らない)
  yearsLaterPerGeneration: 1000,

  // 種の移り変わり(年代順)。ティラノサウルス→…→ニワトリで一周し、以降はまた最初から
  // jumpMultiplier/sizeMultiplier/speedMultiplier はティラノサウルスの数値に統一。
  // 例外はニワトリのjumpMultiplierだけ(飛べない鳥なので低め)。それ以外で種ごとに
  // 変わるのは見た目の色・背景・障害物の意匠だけ
  // yearsAgoStart/yearsAgoEnd はその種の間に「n YEARS AGO」表示が動く範囲(世代が進むにつれて線形に減っていく)
  // decor は背景に流れる簡単な図形(木・岩・草・ビルなど)のサイズと出現間隔
  // obstacleVisuals は障害物の種類ごとの見た目の上書き(仕組みは共通、見た目だけ時代で変える)
  species: [
    {
      name: "TYRANNOSAURUS",
      color: "#3a2f2f",
      jumpMultiplier: 0.9,
      sizeMultiplier: 1.05,
      speedMultiplier: 0.95,
      yearsAgoStart: 68000000,
      yearsAgoEnd: 66000000,
      bgColor: "#dfe8d0",
      decor: { color: "#7a9c6a", width: 12, height: 50, minInterval: 100, maxInterval: 160 },
      obstacleVisuals: {
        spike: { color: "#4a6a2a", width: 14, height: 28 }, // トゲのある植物
      },
    },
    {
      name: "ASTERIORNIS",
      color: "#4a3f2a",
      jumpMultiplier: 0.9,
      sizeMultiplier: 1.05,
      speedMultiplier: 0.95,
      yearsAgoStart: 66000000,
      yearsAgoEnd: 60000000,
      bgColor: "#e8dcc8",
      decor: { color: "#a68a6a", width: 24, height: 18, minInterval: 130, maxInterval: 200 },
      obstacleVisuals: {
        spike: { color: "#7a6a52", width: 16, height: 22 }, // 枯れた棘の茂み
      },
    },
    {
      name: "GASTORNIS",
      color: "#2f3a2f",
      jumpMultiplier: 0.9,
      sizeMultiplier: 1.05,
      speedMultiplier: 0.95,
      yearsAgoStart: 56000000,
      yearsAgoEnd: 40000000,
      bgColor: "#dbe8d5",
      decor: { color: "#6a8c5a", width: 14, height: 45, minInterval: 100, maxInterval: 160 },
      obstacleVisuals: {
        spike: { color: "#3a5a2a", width: 14, height: 28 }, // トゲの茂み
      },
    },
    {
      name: "PHORUSRHACOS",
      color: "#3a3a2a",
      jumpMultiplier: 0.9,
      sizeMultiplier: 1.05,
      speedMultiplier: 0.95,
      yearsAgoStart: 25000000,
      yearsAgoEnd: 2000000,
      bgColor: "#eef0c8",
      decor: { color: "#b8c46a", width: 8, height: 14, minInterval: 60, maxInterval: 110 },
      obstacleVisuals: {
        spike: { color: "#a68a4a", width: 16, height: 20 }, // 乾いた棘の茂み
      },
    },
    {
      name: "CHICKEN",
      color: "#4a4a4a",
      jumpMultiplier: 0.55, // ニワトリはほとんど飛べないので、全種の中でジャンプ力だけ低くする
      sizeMultiplier: 1.05,
      speedMultiplier: 0.95,
      yearsAgoStart: 8000,
      yearsAgoEnd: 0,
      bgColor: "#dfe3e8",
      decor: { color: "#8a94a0", width: 30, height: 70, minInterval: 140, maxInterval: 220 },
      obstacleVisuals: {
        spike: { color: "#4a8a4a", width: 20, height: 20 }, // サボテン
      },
    },
  ],

  // 障害物の種類。種が変わるごと(世代1〜5、generationsPerSpecies=1なのでそのまま種の順番と一致)に
  // 1〜2種類ずつ解禁する(unlockGeneration)。世代1:木の台、世代2:+トゲ、世代3:+転がる岩、
  // 世代4:+飛ぶ敵・穴、世代5:+群れ、で全種類が出そろう。
  // 解禁後は、解禁済みの種類の中から weight(重み)に応じてランダムに選ばれて出現する
  // behavior:
  //   "platform" 上に乗れる。ダメージなし(足場としてground面を一時的に持ち上げる)
  //   "jumpable" 通常の障害物。ジャンプで避ける
  //   "overhead" 頭上の障害物。しゃがんで避ける(低い枝・天井と飛ぶ敵は仕組みが同じなので統一した)
  //   "pit"      地面に針が埋まっている場所。地上にいる時だけダメージ(ジャンプで飛び越える)
  //   "chaser"   後ろ(画面左)から追いついてくる。追いつかれるとダメージ
  //   "flock"    飛ぶ敵(flyer)が何羽も壁のように連なって出現するが、一番下(地面際)は
  //              gapHeightの高さだけ必ず開けておく。しゃがめばどの種・成長段階でも通り抜けられる
  // 見た目(width/height/color)は種ごとの obstacleVisuals で上書きできる。追加の順番・出現頻度・
  // 組み合わせ方はこの配列とdifficulty.obstacleIntervalで調整する
  obstacleKinds: [
    { id: "platform", behavior: "platform", unlockGeneration: 1, weight: 1, width: 26, height: 14, color: "#8a6a3a" },
    { id: "spike", behavior: "jumpable", unlockGeneration: 2, weight: 1.4, width: 16, height: 24, color: "#555555" },
    { id: "boulder", behavior: "chaser", unlockGeneration: 3, weight: 0.8, width: 22, height: 22, color: "#6a6a6a", approachSpeedMultiplier: 1.5 },
    { id: "flyer", behavior: "overhead", unlockGeneration: 4, weight: 1.2, width: 20, height: 14, heightAboveGround: 18, color: "#4a4a6a" },
    { id: "pit", behavior: "pit", unlockGeneration: 4, weight: 0.8, width: 40, height: 12, color: "#6a1a1a" },
    // segmentKind: 群れを構成する1羽あたりの見た目をどのkindから借りるか(flyerと共通にする)
    { id: "flock", behavior: "flock", unlockGeneration: 5, weight: 0.7, segmentKind: "flyer", gapHeight: 28, topMargin: 30 },
  ],

  // 障害物に当たってから次の当たり判定が発生するまでの無敵フレーム数(若返り直後の連続ヒットを防ぐ)
  invulnFramesAfterHit: 90,

  // 産卵演出: 減速して完全停止 → 世代の結果を表示 → 孵化して加速再開、の3段階(単位はすべてフレーム数)
  // 合計(decelFrames+holdFrames+accelFrames)が演出全体の長さ。60fpsなら210フレームで約3.5秒
  layAnimation: {
    decelFrames: 40, // スクロールが今の速度から0まで減速する時間
    holdFrames: 120, // 完全停止して世代の結果を表示している時間(この間に障害物・エサを消し、孵化する)
    accelFrames: 50, // 0から次の世代のヒナの速度まで加速する時間
  },

  // 隕石イベント: 産卵演出のhold(世代結果表示)の直後に挟む特別な演出。2箇所で発生する
  // (1) 最初の種(ティラノサウルス)の最後の世代が終わるタイミング(恐竜時代の終わり)
  // (2) 最後から2番目の種(フォルスラコス)の最後の世代が終わるタイミング(→現代のニワトリへ)
  // 周回して再びこれらの遷移が来るたびに、毎回発生する
  meteorEvent: {
    fallFrames: 60, // 隕石が画面右上から落ちてくる時間
    flashFrames: 20, // 着弾の閃光
    color: "#3a1a0a", // 隕石本体の色
    flashColor: "#fff3d0", // 着弾時に画面全体を覆う閃光の色
  },

  // エサ
  food: {
    width: 10,
    height: 10,
    color: "#999999",
    heightAboveGround: [0, 70], // 地面すれすれ〜ジャンプで届く高さの範囲でランダム配置
  },

  // 距離表示
  metersPerFrame: 0.1, // スクロール速度(px/フレーム)に応じた見かけ上の距離換算
};
