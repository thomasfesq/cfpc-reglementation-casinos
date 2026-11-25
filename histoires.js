window.CFPC_STORIES = {
  "reg-acces-mineur": {
    scene: {
      place: "Contrôle d’entrée",
      speaker: "Une personne accompagnante",
      line: "On entre juste un instant pour voir la salle ?"
    },
    variant: {
      question: "Une jeune de 17 ans souhaite rejoindre sa sœur majeure dans la salle de jeux. Elle dit qu’elle restera près de l’entrée et qu’elle ne jouera pas. Que décidez-vous ?",
      options: [
        "L’admettre si sa sœur la rejoint au contrôle.",
        "L’admettre brièvement si elle reste près de l’entrée.",
        "Lui refuser l’accès à la salle de jeux."
      ],
      answer: 2,
      explanation: "Le contrôle porte sur l’admission dans la salle. Même accompagnée de sa sœur majeure et sans jouer, cette personne mineure ne peut pas entrer."
    }
  },
  "reg-acces-prestataire": {
    scene: {
      place: "Accès des prestataires",
      speaker: "Technicien extérieur",
      line: "J’ai mon badge d’intervention. Est-ce que je peux jouer un coup ?"
    },
    variant: {
      question: "En attendant de pouvoir commencer son intervention, un technicien présente son badge de prestataire pour jouer à une machine à sous. Que lui permet ce badge ?",
      options: [
        "Il permet de l’identifier comme prestataire, sans lui donner le droit de jouer.",
        "Il lui permet de jouer tant que l’intervention n’a pas commencé.",
        "Il lui permet de jouer sur une autre machine que celle où il doit intervenir."
      ],
      answer: 0
    }
  },
  "reg-roulette-mise-tardive": {
    scene: {
      place: "Bord du tapis de roulette",
      speaker: "Joueur",
      line: "La bille tourne encore. Mon jeton compte ?"
    },
    variant: {
      question: "À la roulette française, le joueur désigne le numéro 17. Son jeton est encore dans sa main au moment du « Rien ne va plus ». Il le pose ensuite sur le 17. Le jeton participe-t-il au coup ?",
      options: [
        "Oui, car le joueur avait désigné le numéro avant l’annonce.",
        "Non, car le jeton n’était pas sur le tableau au moment de l’annonce.",
        "Oui, si la bille tournait encore au moment du dépôt."
      ],
      answer: 1
    }
  },
  "reg-roulette-zero": {
    scene: {
      place: "Roulette française",
      speaker: "Joueur",
      line: "La bille s’est arrêtée sur zéro. Que devient ma mise ?"
    },
    variant: {
      question: "Le zéro sort à la roulette française. La séance continue et le joueur vient de miser 30 € sur pair pour ce coup. Quelles options lui proposer ?",
      options: [
        "Retirer 15 € ou laisser sa mise en prison.",
        "Retirer 30 € ou laisser sa mise en prison.",
        "Retirer 15 € obligatoirement, sans pouvoir laisser la mise en prison."
      ],
      answer: 0
    }
  },
  "reg-blackjack-sabot": {
    scene: {
      place: "Table de black-jack avant l’ouverture",
      speaker: "Chef de table",
      line: "On vérifie les jeux de cartes avant de préparer le sabot."
    },
    variant: {
      question: "Pour ouvrir une table de black-jack, trois jeux de 52 cartes à dos bleu ont déjà été vérifiés. Quels jeux faut-il ajouter à cette préparation ?",
      options: [
        "Trois autres jeux de 52 cartes à dos bleu.",
        "Trois jeux de 52 cartes à dos rouge.",
        "Cinq jeux de 52 cartes à dos rouge."
      ],
      answer: 1
    }
  },
  "reg-blackjack-tirage": {
    scene: {
      place: "Table de black-jack en jeu",
      speaker: "Chef de table",
      line: "Les joueurs ont terminé. C’est au tour de la banque."
    },
    variant: {
      question: "Au black-jack, toutes les mains des joueurs sont déterminées. Le croupier avait 14 points sans as et vient de tirer un 2. Que doit-il faire maintenant ?",
      options: [
        "S’arrêter, car il a déjà tiré une carte supplémentaire.",
        "S’arrêter si sa main bat les mains encore en jeu.",
        "Tirer de nouveau, car son total est encore inférieur à 17."
      ],
      answer: 2
    }
  },
  "reg-mas-remplacement": {
    scene: {
      place: "Allée des machines à sous",
      speaker: "Mécanicien du casino",
      line: "Je m’occupe des machines. Tu as de quoi noter le mouvement ?"
    },
    variant: {
      question: "Une machine réparée revient en salle et reprend la place de la machine de réserve qui la remplaçait. Quelle mention inscrire pour ce mouvement ?",
      options: [
        "Les numéros fabricant et casino des deux machines, le motif, la date et l’heure dans le registre de contrôle technique.",
        "Les seuls numéros casino des deux machines, avec la date, dans le registre de contrôle technique.",
        "Le numéro constructeur de la machine réparée et la date dans son carnet de comptabilité."
      ],
      answer: 0
    }
  },
  "reg-mas-jackpot": {
    scene: {
      place: "Caisse des machines à sous",
      speaker: "Caissière",
      line: "J’ai renseigné le bon et le registre. Il reste les signatures."
    },
    variant: {
      question: "À la caisse, le bon de paiement d’un jackpot et le registre sont renseignés. Le joueur propose de signer. Quelles signatures sont requises sur les deux documents ?",
      options: [
        "Celles du joueur et du membre du comité de direction.",
        "Celles du caissier et du membre du comité de direction.",
        "Celles du joueur et du caissier."
      ],
      answer: 1
    }
  },
  "reg-controle-inventaire": {
    scene: {
      place: "Bureau du contrôle technique",
      speaker: "Responsable de salle",
      line: "Je prépare l’inventaire technique pour le contrôle."
    },
    variant: {
      question: "Deux machines identiques ont suivi des interventions différentes. Comment tenir et valider leur inventaire technique ?",
      options: [
        "Tenir une fiche commune au modèle et la faire signer par le directeur responsable.",
        "Tenir une fiche par machine, actualisée régulièrement et signée par le technicien.",
        "Tenir une fiche par machine, actualisée régulièrement et signée par le directeur responsable ou un membre du comité de direction."
      ],
      answer: 2
    }
  },
  "reg-controle-ouverture": {
    scene: {
      place: "Salle des machines à sous en activité",
      speaker: "Agent chargé du contrôle",
      line: "Je voudrais faire ouvrir cette machine pendant mon contrôle."
    },
    variant: {
      question: "En pleine soirée, un fonctionnaire du service central des courses et jeux demande l’ouverture d’une machine en exploitation. Peut-il l’exiger à ce moment ?",
      options: [
        "Oui, il peut faire ouvrir une machine à tout moment, y compris en exploitation.",
        "Non, il doit attendre la clôture des jeux.",
        "Seulement si la machine a déjà été signalée en panne."
      ],
      answer: 0
    }
  },
  "reg-protection-duree": {
    scene: {
      place: "Accueil, à l’écart de la file",
      speaker: "Cliente",
      line: "On peut parler un instant de mon interdiction volontaire ?"
    },
    variant: {
      question: "L’interdiction volontaire d’une personne a pris effet il y a quatre ans. Sans avoir demandé sa levée, elle pense que le délai l’autorise à entrer. Que lui répondez-vous ?",
      options: [
        "L’interdiction a pris fin dès le troisième anniversaire de la mesure.",
        "La direction du casino peut lever la mesure après vérification de la date.",
        "La mesure reste en vigueur. La personne peut en demander la levée auprès de l’ANJ."
      ],
      answer: 2
    }
  },
  "reg-protection-portee": {
    scene: {
      place: "Accueil du casino",
      speaker: "Visiteur",
      line: "Est-ce que mon interdiction me suit si je change d’établissement ?"
    },
    variant: {
      question: "Un joueur sous interdiction volontaire pense pouvoir entrer dans un club de jeux français parce qu’il ne s’agit pas de son casino habituel. Que lui répondez-vous ?",
      options: [
        "Le club peut l’admettre parce que l’interdiction ne vise que le casino habituel.",
        "L’interdiction vaut dans tous les casinos et clubs de jeux en France.",
        "Le club peut l’admettre s’il appartient à un autre groupe."
      ],
      answer: 1
    }
  }
};
