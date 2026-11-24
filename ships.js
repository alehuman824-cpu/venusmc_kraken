// 이착륙 신고용 함선 목록 (RSI 공식 Ship Matrix 기준, 비행 가능(flight-ready)한 함선만)
// small = 소형(Small), medium = 중형(Medium). 지상 차량(ROC, Cyclone 등)은 제외했어요.
window.SHIPS = {
  small: [
    "100i","125a","135c","300i","315p","325a","350r","85X",
    "Arrow","Aurora Mk I CL","Aurora Mk I ES","Aurora Mk I LN","Aurora Mk I LX","Aurora Mk I MR","Aurora Mk I SE",
    "Avenger Stalker","Avenger Titan","Avenger Titan Renegade","Avenger Warlock",
    "Blade","Buccaneer","C8 Pisces","C8R Pisces","C8X Pisces Expedition","Defender",
    "Dragonfly Black","Dragonfly Yellowjacket","Eclipse",
    "F7A Hornet Mk I","F7C Hornet Mk I","F7C Hornet Wildfire Mk I","F7C-M Super Hornet Heartseeker Mk I","F7C-M Super Hornet Mk I","F7C-R Hornet Tracker Mk I","F7C-S Hornet Ghost Mk I",
    "Gladiator","Gladius","Gladius Pirate Edition","Gladius Valiant","Hawk","Herald","Hull A","Hurricane",
    "M50","Mantis","MPUV Cargo","MPUV Personnel","MPUV Tractor",
    "Mustang Alpha","Mustang Alpha Vindicator","Mustang Beta","Mustang Delta","Mustang Gamma","Mustang Omega",
    "Nomad","Nox","Nox Kue","P-52 Merlin","P-72 Archimedes","P-72 Archimedes Emerald","Prospector",
    "Razor","Razor EX","Razor LX",
    "Sabre","Sabre Comet","Sabre Firebird","Sabre Peregrine","Sabre Raven","Sabre Raven EX",
    "San'tok.yāi","Scorpius","Scorpius Antares","Talon","Talon Shrike","Terrapin","Terrapin Medic","Vulture",
    "X1","X1 Force","X1 Velocity"
  ],
  medium: [
    "Ares Inferno","Ares Ion","Cutlass Black","Cutlass Blue","Cutlass Red","Cutlass Steel",
    "Freelancer","Freelancer DUR","Freelancer MAX","Freelancer MIS","Glaive","Khartu-al","MOLE",
    "Mole Carbon Edition","Mole Talus Edition","Prowler","Prowler Utility","RAFT",
    "Reliant Kore","Reliant Mako","Reliant Sen","Reliant Tana","Scythe","SRV",
    "Vanguard Harbinger","Vanguard Hoplite","Vanguard Sentinel","Vanguard Warden"
  ]
};
