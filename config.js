// 調整用の数値をまとめる設定ファイル
const CONFIG = {
  canvasWidth: 800,
  canvasHeight: 300,
  groundHeight: 40,
  skyColor: "#f7f7f7", // 空(背景)の色。種によらず全種共通(原作のChrome恐竜ゲームと同じ白系)
  groundColor: "#f7f7f7", // 地面の下地の色。空と同じ白にして、地面模様(線)だけが見えるようにする
  groundSprite: "assets/ground.png", // 地面に重ねて描く模様(線とドット)。スクロールに合わせて流れる
  // groundSprite画像の中で「地面の線(直線部分)」が上端から何%の位置にあるか(0〜1)。
  // プレイヤー・障害物が実際に乗る高さ(groundY)はこの線の位置に揃え、線から上に飛び出す
  // でこぼこ(草や小石の盛り上がり)は当たり判定に関係ない飾りとして扱う
  groundLineRatio: 0.25,

  // 効果音。volumeは0(無音)〜1(最大)。個別に音量を変えたい場合はvolumesで上書きする
  sounds: {
    volume: 0.5,
    volumes: {
      jump: 0.08, // ジャンプ音は他より耳につきやすいのでさらに控えめにする
      pickup: 0.25, // エサ取得音も控えめにする
    },
    jump: "assets/jump.wav", // ジャンプした瞬間
    pickup: "assets/pickup.wav", // エサ(木の実)を取った瞬間
    damage: "assets/damage.mp3", // 障害物に当たって若返った/ゲームオーバーになった瞬間
    hatch: "assets/hatch.m4a", // 卵からヒナが孵った瞬間
    lay: "assets/lay.mp3", // 大人が産卵を始めた瞬間
    pause: "assets/pause.mp3", // 一時停止ボタンを押した瞬間(再開時も鳴らす)
    boulder: "assets/boulder.mp3", // 後ろから転がってくる岩が出現した瞬間
    confirm: "assets/confirm.mp3", // タイトルでスタート、結果画面でリトライを押した瞬間
  },

  // BGM: タイトル画面も含めてループ再生し、一時停止中・結果画面だけ止める
  bgm: {
    src: "assets/bgm.mp3",
    volume: 0.18, // 効果音より控えめにする
  },

  // 空を流れる雲。種によらず共通
  clouds: {
    color: "#dcdcdc",
    width: 46,
    height: 14,
    minY: 20,
    maxY: 90,
    minInterval: 150,
    maxInterval: 260,
    parallax: 0.15,
  },

  // 若い恐竜・大人の段階で、種専用の絵がない場合に使う走りアニメーション(run1.png/run2.png
  // を交互に切り替えて走っているように見せる)。framesPerPoseは1つの絵を何フレーム表示するか
  runAnimation: {
    framesPerPose: 8,
  },

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
    { name: "EGG", isEgg: true, width: 18, height: 18, color: "#cccccc", hatchFrames: 90, speedMultiplier: 0.5 },
    { name: "CHICK", width: 21, height: 26, jumpPower: 10, color: "#333333", foodToGrow: 3, speedMultiplier: 0.8 },
    { name: "JUVENILE", width: 29, height: 35, jumpPower: 9, color: "#333333", foodToGrow: 4, speedMultiplier: 1.1 },
    { name: "ADULT", width: 39, height: 49, jumpPower: 8, color: "#333333", foodToGrow: 5, speedMultiplier: 1.3 },
  ],

  // 世代ごとの難易度カーブ。成長に必要なエサ数(stages[].foodToGrow)は全世代で統一し、
  // その代わりに世代が進むごとにベース速度と障害物密度を上げ、エサの出現頻度を下げていく
  difficulty: {
    // ベース速度(このあと段階ごとの speedMultiplier を掛けたものが実際のスクロール速度になる)
    // 1周(LOOP)の中ではずっと一定(世代が1つ進むごとの増減はなし)。周回が変わるとき、
    // 「この周回の大人の最高速度」と「次の周回のヒナの速度」がちょうど一致するように
    // 上がる(大人とヒナのspeedMultiplierの比率ぶん。種のspeedMultiplierは全種共通なので
    // 相殺される)。これを毎周回繰り返すので、周回を重ねるほど指数的に速くなる(maxで頭打ち)
    baseSpeed: {
      start: 7, // 1周目(LOOP1)のベース速度
      max: 30, // 上限。この値を超えて速くはしない
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
  yearsLaterPerGeneration: 10000,

  // 種の移り変わり(年代順)。ティラノサウルス→…→ニワトリで一周し、以降はまた最初から
  // jumpMultiplier/sizeMultiplier/speedMultiplier はティラノサウルスの数値に統一。
  // 例外はニワトリのjumpMultiplierだけ(飛べない鳥なので低め)。それ以外で種ごとに
  // 変わるのは見た目の色・障害物の意匠だけ(空の色は全種共通。CONFIG.skyColorを参照)
  // yearsAgoStart/yearsAgoEnd はその種の間に「n YEARS AGO」表示が動く範囲(世代が進むにつれて線形に減っていく)
  // obstacleVisuals は障害物の種類ごとの見た目の上書き(仕組みは共通、見た目だけ時代で変える)
  // sprite: 若い恐竜・大人の見た目に使う種専用の静止画(assets/配下)。指定がない種は
  // 汎用の走りアニメーション(run1.png/run2.png)を使う。若い恐竜の段階はこの同じ画像を
  // 小さいサイズで描画する(専用の縮小版画像は用意しない)
  // runSprite: spriteの代わりに、種専用の走りアニメーション2枚を指定する場合に使う
  // ([フレーム1, フレーム2]。両方指定した場合はrunSpriteが優先される)
  // chickSprite: ヒナの見た目に使う種専用の静止画。指定がない種は汎用のchick.pngを使う
  // (卵は種によらず常にegg.pngを使う)
  // chickRunSprite: chickSpriteの代わりに、ヒナ用の走りアニメーション2枚を指定する場合に
  // 使う([フレーム1, フレーム2]。両方指定した場合はchickRunSpriteが優先される)
  species: [
    {
      name: "TYRANNOSAURUS",
      color: "#3a2f2f",
      jumpMultiplier: 0.9,
      sizeMultiplier: 1.05,
      speedMultiplier: 0.95,
      yearsAgoStart: 68000000,
      yearsAgoEnd: 66000000,
      skeletonSprite: "assets/tyrannosaurus-skeleton.png", // 次の世代が生まれた瞬間、親をこの骨の姿に切り替える
      obstacleVisuals: {
        spike: { color: "#4a6a2a", width: 18, height: 36, sprite: "assets/needle.png" }, // トゲのある植物→サボテンの絵を流用
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
      sprite: "assets/asteriornis.png",
      runSprite: ["assets/asteriornis-run1.png", "assets/asteriornis-run2.png"],
      skeletonSprite: "assets/asteriornis-skeleton.png",
      obstacleVisuals: {
        spike: { color: "#7a6a52", width: 21, height: 29, sprite: "assets/needle.png" }, // トゲのある植物→サボテンの絵を流用
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
      sprite: "assets/gastornis.png",
      runSprite: ["assets/gastornis-run1.png", "assets/gastornis-run2.png"],
      skeletonSprite: "assets/gastornis-skeleton.png",
      obstacleVisuals: {
        spike: { color: "#3a5a2a", width: 18, height: 36, sprite: "assets/needle.png" }, // トゲのある植物→サボテンの絵を流用
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
      sprite: "assets/phorusrhacos.png",
      runSprite: ["assets/phorusrhacos-run1.png", "assets/phorusrhacos-run2.png"],
      skeletonSprite: "assets/phorusrhacos-skeleton.png",
      obstacleVisuals: {
        spike: { color: "#a68a4a", width: 21, height: 26, sprite: "assets/needle.png" }, // トゲのある植物→サボテンの絵を流用
      },
    },
    {
      name: "CHICKEN",
      color: "#4a4a4a",
      jumpMultiplier: 0.65, // ニワトリはほとんど飛べないので、全種の中でジャンプ力だけ低くする
      sizeMultiplier: 1.05,
      speedMultiplier: 0.95,
      yearsAgoStart: 8000,
      yearsAgoEnd: 0,
      sprite: "assets/chicken.png",
      runSprite: ["assets/chicken-run1.png", "assets/chicken-run2.png"],
      chickSprite: "assets/chicken-chick.png",
      chickRunSprite: ["assets/chicken-chick-run1.png", "assets/chicken-chick-run2.png"],
      foodSprite: "assets/berry.png", // 木の実(ニワトリ世代だけ見た目を変える)
      skeletonSprite: "assets/chicken-skeleton.png",
      obstacleVisuals: {
        spike: { color: "#4a4a4a", width: 25, height: 28, sprite: "assets/cone.png" }, // コーン
        // pit(地面の障害物)は針の代わりに車、flyer(頭上の障害物・群れ)はプテラの代わりに
        // 飛行機にする。flyerはspriteFrames(2枚アニメーション)ではなく静止画1枚なので、
        // 汎用側のspriteFramesを打ち消すためnullを明示している
        pit: { color: "#4a4a4a", width: 36, height: 17, sprite: "assets/car.png" }, // 車
        flyer: { color: "#4a4a4a", width: 34, height: 14, sprite: "assets/airplane.png", spriteFrames: null }, // 飛行機
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
  // sprite/spriteFramesを指定すると、colorの塗りつぶし矩形の代わりにドット絵を描画する
  // (spriteFramesは[フレーム1, フレーム2]で、走りアニメーションと同じ周期で交互に切り替わる)
  obstacleKinds: [
    { id: "platform", behavior: "platform", unlockGeneration: 1, weight: 1, width: 34, height: 18, color: "#8a6a3a", sprite: "assets/platform.png" },
    { id: "spike", behavior: "jumpable", unlockGeneration: 2, weight: 1.4, width: 21, height: 31, color: "#555555" },
    {
      id: "boulder",
      behavior: "chaser",
      unlockGeneration: 3,
      weight: 0.8,
      width: 29,
      height: 29,
      color: "#6a6a6a",
      approachSpeedMultiplier: 1.5,
      spriteFrames: ["assets/boulder1.png", "assets/boulder2.png"], // 転がって見えるよう交互に切り替える
    },
    {
      id: "flyer",
      behavior: "overhead",
      unlockGeneration: 4,
      weight: 1.2,
      width: 26,
      height: 18,
      heightAboveGround: 23,
      color: "#4a4a6a",
      spriteFrames: ["assets/ptera1.png", "assets/ptera2.png"], // 羽ばたきで交互に切り替える
    },
    { id: "pit", behavior: "pit", unlockGeneration: 4, weight: 0.8, width: 52, height: 16, color: "#6a1a1a", sprite: "assets/vine.png" }, // 地面から伸びる低いツタ
    // segmentKind: 群れを構成する1羽あたりの見た目をどのkindから借りるか(flyerと共通にする)
    { id: "flock", behavior: "flock", unlockGeneration: 5, weight: 0.7, segmentKind: "flyer", gapHeight: 36, topMargin: 39 },
  ],

  // 障害物に当たってから次の当たり判定が発生するまでの無敵フレーム数(若返り直後の連続ヒットを防ぐ)
  invulnFramesAfterHit: 90,

  // ゲームオーバー直後、リトライ入力を受け付けない猶予フレーム数
  // (死んだ瞬間に押しっぱなしだったキーのオートリピートなどで、結果画面を見る間もなく
  // 即リトライしてしまうのを防ぐ)
  retryCooldownFrames: 45,

  // 産卵演出: 減速して完全停止 → 世代の結果を表示 → 孵化して加速再開、の3段階(単位はすべてフレーム数)
  // 合計(decelFrames+holdFrames+accelFrames)が演出全体の長さ。60fpsなら210フレームで約3.5秒
  layAnimation: {
    decelFrames: 40, // スクロールが今の速度から0まで減速する時間
    holdFrames: 120, // 完全停止して世代の結果を表示している時間(この間に障害物・エサを消し、孵化する)
    accelFrames: 50, // 0から次の世代のヒナの速度まで加速する時間
  },

  // 演出: 孵化(卵→ヒナ)する直前に卵を点滅させて盛り上げる
  // (通常の孵化タイマーでも、産卵演出中のhold明けの孵化でも同じ設定を使う)
  hatchEffect: {
    flashFrames: 12, // 孵化の何フレーム前から点滅を始めるか
    flashIntervalFrames: 3, // 点滅の切り替わり周期(このフレームごとに色が反転する)
    flashColor: "#ffffff",
  },

  // 演出: 産卵した直後、親を一瞬つぶれさせてから元の形に戻し「産んだ」感を出す
  layPulse: {
    frames: 14, // つぶれてから元の高さに戻るまでの時間
    squashRatio: 0.6, // 一番つぶれた瞬間の高さの倍率
  },

  // エサ
  food: {
    width: 18,
    height: 18,
    color: "#999999",
    sprite: "assets/fruit.png", // 木の実(恐竜・鳥の世代の見た目。種ごとにfoodSpriteで上書きできる)
    heightAboveGround: [0, 70], // 地面すれすれ〜ジャンプで届く高さの範囲でランダム配置
  },

  // 距離表示
  metersPerFrame: 0.1, // スクロール速度(px/フレーム)に応じた見かけ上の距離換算

  // タイトル画面: ゲーム開始前に表示し、何か操作すると始まる
  titleScreen: {
    title: "LIFE'S BATON",
    subtitle: "DINOSAUR RUN",
    startPrompt: "TAP / CLICK / SPACE TO START",
    startPromptBlinkIntervalFrames: 30, // 開始案内を点滅させる周期(この値ごとに表示/非表示が切り替わる)
    // タッチ操作端末でだけ表示する操作案内(2行)
    touchHint: ["TAP OR SWIPE UP: JUMP", "SWIPE DOWN: CROUCH   LEFT/RIGHT: MOVE"],
    dimColor: "rgba(255,255,255,0.75)", // タイトル文字の背後を薄く白で覆って読みやすくする
  },

  // 結果画面(ゲームオーバー時)の見た目
  resultScreen: {
    dimColor: "rgba(0,0,0,0.35)", // 背後のゲーム画面を暗く覆う
    panelColor: "#ffffff",
    panelBorderColor: "#000000",
    retryBlinkIntervalFrames: 20, // リトライ操作を受け付け始めたら、この周期で案内文を点滅させる
  },

  // 結果画面の「Xでシェア」ボタン。押すとX(旧Twitter)の投稿画面を新しいタブで開く
  // (本文には世代数・通算距離を毎回埋め込む。文言はgame.js側で組み立てる)
  share: {
    hashtags: "命のバトン恐竜ラン",
  },

  // 自己ベストランキング(世界ランキングの代わりに、ブラウザのlocalStorageへ保存する個人記録)
  highScores: {
    maxEntries: 5, // 保存しておく件数(距離が長い順)
    storageKey: "dinoBatonHighScores",
  },
};
