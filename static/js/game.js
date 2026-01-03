/* =========================
   EMOJI MAP
========================= */
const EMOJI_MAP = {
  cua: "🦀",
  bau: "🍐",
  ngua: "🐎",
  ca: "🐟",
  tom: "🦐",
  ga: "🐓"
};
const ANIMALS = Object.keys(EMOJI_MAP);

/* =========================
   GLOBAL STATE
========================= */
let isSpinning = false;
let pendingLixi = 0;

/* =========================
   MUSIC
========================= */
const bgMusic = new Audio("/static/sound/tet.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.5;

function toggleMusic(on){
  on ? bgMusic.play().catch(()=>{}) : bgMusic.pause();
}
function setVolume(v){ bgMusic.volume = v; }

/* =========================
   SET USER
========================= */
function setUser(){
  const name = document.getElementById("name").value.trim();
  if(!name){
    alert("Vui lòng nhập tên");
    return;
  }

  fetch("/set-user",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ name })
  })
  .then(r=>r.json())
  .then(d=>{
    if(d.error){
      alert(d.error);
      return;
    }

    document.getElementById("money").innerText = d.money;
    document.getElementById("turns").innerText = d.turns;
    document.getElementById("lixiLeft").innerText = d.lixi_left;

    bgMusic.play().catch(()=>{});
  });
}

/* =========================
   TOOLTIP
========================= */
function showRewardTooltip(targetEl, text, type="win"){
  const rect = targetEl.getBoundingClientRect();
  const tip = document.createElement("div");

  tip.className = `reward-tip reward-${type}`;
  tip.innerText = text;

  tip.style.left = rect.left + rect.width/2 + "px";
  tip.style.top  = rect.top - 10 + "px";
  tip.style.transform = "translateX(-50%)";

  document.body.appendChild(tip);
  setTimeout(()=> tip.remove(), 2000);
}

/* =========================
   PLAY GAME
========================= */
function play(){
  if(isSpinning) return;
  isSpinning = true;

  const bets = {};
  document.querySelectorAll(".bet-input").forEach(i=>{
    bets[i.dataset.animal] = parseInt(i.value || 0);
  });

  /* RESET DICE -> TRẮNG */
  const dice = document.querySelectorAll(".dice");
  dice.forEach(d=>{
    d.classList.remove("done");
    d.innerText = "❓";
  });

  fetch("/play",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(bets)
  })
  .then(r=>r.json())
  .then(d=>{
    if(d.error){
      alert(d.error);
      isSpinning = false;
      return;
    }

    /* UPDATE STATUS */
    const oldTurns = parseInt(document.getElementById("turns").innerText);
    const oldLixi  = parseInt(document.getElementById("lixiLeft").innerText);

    document.getElementById("money").innerText = d.money;
    document.getElementById("turns").innerText = d.turns;
    document.getElementById("lixiLeft").innerText = d.lixi_left;

    const anim = d.animation;

    /* =========================
       SPIN EASE OUT
    ========================= */
    let currentSpeed = anim.dice_spin_speed;
    const maxSpeed = anim.dice_spin_speed * 2.5;
    let spinTimer = null;

    function spinOnce(){
      dice.forEach(el=>{
        const rand = ANIMALS[Math.floor(Math.random()*ANIMALS.length)];
        el.innerText = EMOJI_MAP[rand];
      });

      currentSpeed = Math.min(
        currentSpeed + (maxSpeed - currentSpeed) * 0.08,
        maxSpeed
      );

      spinTimer = setTimeout(spinOnce, currentSpeed);
    }

    spinOnce();

    /* =========================
       STOP TỪNG Ô
    ========================= */
    setTimeout(()=>{
      clearTimeout(spinTimer);

      d.result.forEach((r,i)=>{
        setTimeout(()=>{
          dice[i].innerText = EMOJI_MAP[r];
          dice[i].classList.add("done");   // ⬅️ CHỈ DÒNG NÀY LÀ MÀU ĐEN

          if(i === d.result.length - 1){

            if(navigator.vibrate){
              navigator.vibrate(anim.vibrate_ms);
            }

            if(d.win > 0){
              showRewardTooltip(dice[1], `+${d.win}$`, "win");
            }else{
              showRewardTooltip(dice[1], "Không trúng 😢", "lose");
            }

            if(d.turns > oldTurns){
              showRewardTooltip(dice[0], "+ Lượt 🎮", "bonus");
            }

            if(d.lixi_left > oldLixi){
              showRewardTooltip(dice[2], "+ Lì xì 🧧", "bonus");
            }

            updateLeaderboard(d.leaderboard);
            isSpinning = false;
          }
        }, anim.dice_stop_delay * i);
      });

    }, anim.spin_time);
  });
}

/* =========================
   LÌ XÌ
========================= */
function lixi(){
  fetch("/lixi",{ method:"POST" })
  .then(r=>r.json())
  .then(d=>{
    if(d.error){
      alert(d.error);
      return;
    }

    pendingLixi = d.lixi;

    document.getElementById("lixiLeft").innerText =
      parseInt(document.getElementById("lixiLeft").innerText) - 1;

    document.getElementById("lixi-overlay").classList.remove("hidden");
    updateLeaderboard(d.leaderboard);
  });
}

function openLixi(){
  document.getElementById("lixi-overlay").classList.add("hidden");

  document.getElementById("money").innerText =
    parseInt(document.getElementById("money").innerText) + pendingLixi;

  alert("🧧 Bạn nhận được " + pendingLixi + "$");
  pendingLixi = 0;
}

/* =========================
   LEADERBOARD
========================= */
function updateLeaderboard(lb){
  const ul = document.getElementById("leaderboard");
  ul.innerHTML = "";

  lb.forEach((p,i)=>{
    const li = document.createElement("li");
    li.innerText = `${p.name} — ${p.money}$`;
    if(i === 0) li.classList.add("top1");
    ul.appendChild(li);
  });
}
/* =========================
   LIMIT BET TO 2 ANIMALS
========================= */
document.querySelectorAll(".bet-input").forEach(input => {
  input.addEventListener("input", () => {
    const inputs = document.querySelectorAll(".bet-input");

    // Đếm số ô đang có cược > 0
    let count = 0;
    inputs.forEach(i => {
      if (parseInt(i.value || 0) > 0) count++;
    });

    // Nếu vượt quá 2 ô
    if (count > 2) {
      input.value = 0;
      alert("⚠️ Mỗi ván chỉ được đặt cược tối đa 2 ô!");
    }
  });
});
