"use strict";

window.CFPC_TERRAIN = {
  reactions: {
    "reg-acces-mineur": {
      speaker: "Collègue à l’accueil",
      standard: [
        "La présence du parent ne nous permet pas de faire entrer son enfant en salle de jeux.",
        "On arrête la visite au contrôle d’entrée, même si le parent accompagne son enfant.",
        "Attendre de voir si l’enfant mise laisserait passer un mineur dès le contrôle.",
      ],
      variant: [
        "Même si sa sœur majeure vient la chercher, la jeune fille doit rester hors de la salle de jeux.",
        "Rester près de la porte, même un instant, revient à entrer en salle de jeux.",
        "On explique à la jeune fille que sa sœur peut la retrouver en dehors de la salle de jeux.",
      ],
    },
    "reg-acces-prestataire": {
      speaker: "Responsable de salle",
      standard: [
        "Même pendant la pause, le badge de prestataire ne permet pas de jouer.",
        "Changer de table ne transforme pas un badge d’intervention en droit de jouer.",
        "On reconnaît le technicien grâce au badge et on s’en tient à l’objet de son intervention.",
      ],
      variant: [
        "Le badge sert à reconnaître le technicien pendant son intervention, et il ne lui permet pas de jouer.",
        "Le délai avant l’intervention n’ouvre aucun droit de jouer avec le badge.",
        "Même devant une autre machine, le badge garde sa seule fonction d’identification.",
      ],
    },
    "reg-roulette-mise-tardive": {
      speaker: "Chef de table",
      standard: [
        "Attendre l’arrêt de la bille ferait compter des mises déposées après la clôture.",
        "Le jeton est arrivé après l’annonce, il ne participe donc pas à ce coup.",
        "Même si je vois le jeton avant l’annonce du résultat, son dépôt reste tardif.",
      ],
      variant: [
        "Le numéro 17 a bien été désigné, mais le jeton était encore dans la main du joueur à l’annonce.",
        "À l’annonce, le jeton était encore dans sa main, donc on l’écarte de ce coup.",
        "La bille peut encore tourner alors que le dépôt des mises est déjà clos.",
      ],
    },
    "reg-roulette-zero": {
      speaker: "Croupier",
      standard: [
        "Le zéro ne donne droit ni au remboursement intégral des 20 € ni au transfert sur un autre numéro.",
        "Rendre 10 € d’office priverait le joueur du choix de laisser sa mise en prison.",
        "Sur rouge, le joueur choisit de reprendre 10 € ou de laisser les 20 € en prison.",
      ],
      variant: [
        "Sur pair, le joueur choisit de reprendre 15 € ou de laisser les 30 € en prison.",
        "L’option de remboursement rend 15 € sur les 30 € misés, puisque le zéro est sorti.",
        "Imposer le remboursement de 15 € enlèverait un choix au joueur alors que la séance continue.",
      ],
    },
    "reg-blackjack-sabot": {
      speaker: "Chef de table",
      standard: [
        "Avec trois jeux de chaque couleur, on obtient bien les six jeux à vérifier avant la séance.",
        "Le compte est bon, mais il manque la deuxième couleur avant de préparer le sabot.",
        "On retire deux jeux, un de chaque couleur, pour retrouver la composition à six.",
      ],
      variant: [
        "Trois jeux bleus de plus donneraient six jeux de la même couleur.",
        "Avec ces trois jeux rouges, on arrive à six jeux répartis entre les deux couleurs.",
        "Cinq jeux rouges porteraient le total à huit, avec trop de jeux rouges.",
      ],
    },
    "reg-blackjack-tirage": {
      speaker: "Chef de table",
      standard: [
        "Même si les autres mains ne dépassent pas 16, la banque doit poursuivre son tirage.",
        "La banque tire à 16 et vérifie son nouveau total avant de décider si elle s’arrête.",
        "Une seule carte peut ne pas suffire si le nouveau total reste inférieur à 17.",
      ],
      variant: [
        "Le 2 porte la banque à 16, donc il lui reste à tirer.",
        "L’avance éventuelle sur les joueurs ne dispense pas la banque de tirer à 16.",
        "On tire à nouveau puisque la banque est toujours à 16 après le 2.",
      ],
    },
    "reg-mas-remplacement": {
      speaker: "Mécanicien du casino",
      standard: [
        "Le carnet comptable ne permettrait pas de retracer le remplacement avec les deux machines.",
        "Le suivi du mouvement doit se trouver dans le registre de contrôle technique, au retrait comme au retour.",
        "Avec les deux identifiants de chaque machine, le motif, la date et l’heure, le registre retrace le remplacement.",
      ],
      variant: [
        "Le retour figure au registre technique avec les deux paires de numéros, le motif, la date et l’heure.",
        "Le bon registre est ouvert, mais il manque les numéros fabricant, le motif et l’heure.",
        "L’entrée proposée laisserait hors du registre technique le retour et le retrait de la machine de réserve.",
      ],
    },
    "reg-mas-jackpot": {
      speaker: "Collègue à la caisse",
      standard: [
        "Avec la signature du caissier et celle du membre du comité, le bon et le registre sont tous deux signés.",
        "La signature du joueur ne remplace pas celle du membre du comité sur les deux documents.",
        "Une signature seule laisse le bon et le registre incomplets dans cette procédure.",
      ],
      variant: [
        "Avec ces deux signatures, celle du caissier manquerait encore sur le bon et le registre.",
        "Le caissier et le membre du comité signent chacun le bon et le registre.",
        "Même si le joueur signe avec le caissier, il manque la signature du membre du comité.",
      ],
    },
    "reg-controle-inventaire": {
      speaker: "Responsable de salle",
      standard: [
        "Une fiche par salle ne permet pas de retrouver l’historique de chaque machine.",
        "On peut retrouver les opérations de chaque machine sur une fiche à jour portant la signature requise.",
        "Une fiche par modèle ne permet pas de retracer les opérations propres à chaque machine.",
      ],
      variant: [
        "Même signée par le directeur responsable, une fiche commune ne retrace pas les interventions séparées.",
        "Les deux historiques sont bien séparés, mais la signature du technicien ne suffit pas pour l’inventaire.",
        "Chaque machine a son propre historique actualisé, avec la signature du directeur responsable ou d’un membre du comité.",
      ],
    },
    "reg-controle-ouverture": {
      speaker: "Responsable de salle",
      standard: [
        "Reporter l’ouverture à la clôture empêcherait le fonctionnaire compétent de contrôler la machine en exploitation.",
        "Le pouvoir de faire ouvrir la machine s’exerce aussi en dehors d’un rendez-vous avec la maintenance.",
        "Le fonctionnaire chargé du contrôle peut faire ouvrir la machine pendant qu’elle est en exploitation.",
      ],
      variant: [
        "Le fonctionnaire du service central peut faire ouvrir la machine pendant la soirée.",
        "L’activité de la salle n’oblige pas le fonctionnaire à attendre la clôture pour faire ouvrir cette machine.",
        "L’absence de panne signalée n’empêche pas le fonctionnaire de faire ouvrir la machine.",
      ],
    },
    "reg-protection-duree": {
      speaker: "Collègue à l’accueil",
      standard: [
        "On explique à la cliente que la mesure s’applique toujours et lui indique la démarche auprès de l’ANJ.",
        "Admettre la cliente sur la seule date reviendrait à ignorer une interdiction encore en vigueur.",
        "L’accueil ne peut pas lever cette mesure, la démarche relève de l’ANJ.",
      ],
      variant: [
        "Le troisième anniversaire ouvre la possibilité d’une demande de levée et la mesure demeure en vigueur.",
        "Même après quatre ans, le casino ne peut pas lever la mesure de sa propre initiative.",
        "L’accès reste interdit et la personne peut demander à l’ANJ de lever la mesure.",
      ],
    },
    "reg-protection-portee": {
      speaker: "Collègue à l’accueil",
      standard: [
        "Changer de groupe de casinos ne donne pas le droit d’entrer pendant l’interdiction.",
        "L’accueil applique la même interdiction dans tout casino ou club de jeux en France.",
        "Même avec un volet en ligne, la mesure empêche aussi l’entrée dans les casinos et clubs de jeux.",
      ],
      variant: [
        "Le club de jeux doit aussi appliquer l’interdiction, même si le joueur n’y est jamais venu.",
        "Le club de jeux est compris dans le périmètre national, donc le joueur ne peut pas y entrer.",
        "L’appartenance du club à un autre groupe ne change pas la portée de la mesure.",
      ],
    },
  },
  reflexes: {
    "Admission en salle": {
      gesture: "Vérifiez les conditions d’accès au contrôle d’entrée. Identifiez les prestataires à part, pour leur intervention.",
      pitfall: "Une visite avec un adulte majeur ne permet pas d’admettre un mineur. Un badge de prestataire ne donne aucun droit de jouer.",
      rule: "L’article 25 impose un contrôle systématique à l’entrée des salles de jeux pour en refuser l’accès aux mineurs et aux personnes interdites de jeux. Le badge d’intervention est un moyen de reconnaissance.",
      sources: ["reg-acces-mineur"],
    },
    "Roulette française": {
      gesture: "Regardez si le jeton était déjà sur le tapis au « Rien ne va plus ». Si le zéro sort avant le dernier coup, présentez les deux choix pour une mise nouvelle sur une chance simple, comme rouge ou pair.",
      pitfall: "Une bille encore en mouvement ne prolonge pas le dépôt des mises. Rendre la moitié d’office retire au joueur son choix lorsque la séance continue.",
      rule: "L’annonce ferme les mises. Au zéro, on peut reprendre la moitié d’une nouvelle mise sur une chance simple ou la laisser entière « en prison » pour le coup suivant, sauf au dernier coup où un remboursement s’impose.",
      sources: ["reg-roulette-mise-tardive", "reg-roulette-zero"],
    },
    "Black-jack": {
      gesture: "Contrôlez le nombre de jeux, les deux couleurs et l’état des cartes à l’ouverture. Quand les joueurs ont terminé, recalculez le total du croupier après chaque tirage.",
      pitfall: "Six jeux d’une seule couleur ne conviennent pas. À 16, la banque doit tirer même si elle mène face aux joueurs.",
      rule: "Le sabot se prépare avec six jeux de 52 cartes en parfait état, trois de chaque couleur. Le croupier tire à 16 ou moins et s’arrête à 17 ou plus.",
      sources: ["reg-blackjack-sabot"],
    },
    "Machines à sous": {
      gesture: "Pour un échange de machines, relevez les numéros fabricant et casino des deux appareils, le motif, la date et l’heure. Pour un jackpot traité avec un bon, vérifiez les signatures du caissier et du membre du comité de direction sur le bon et le registre.",
      pitfall: "Lors d’un échange, un seul numéro ne permet pas de retracer les deux appareils. La signature du joueur ne remplace aucune des deux signatures prévues en caisse.",
      rule: "Le registre de contrôle technique retrace le retrait, le remplacement et le retour de réparation. Pour la procédure de jackpot avec bon de paiement, le caissier renseigne le bon et le registre, puis les signe avec le membre du comité de direction.",
      sources: ["reg-mas-remplacement", "reg-mas-jackpot"],
    },
    "Surveillance et contrôle": {
      gesture: "Retrouvez l’historique sur la fiche individuelle de la machine et vérifiez sa mise à jour et sa signature. Si un fonctionnaire compétent demande l’ouverture, tenez compte de son pouvoir de contrôle en cours d’exploitation.",
      pitfall: "Une fiche par modèle confond des historiques différents. L’ouverture demandée en cours d’exploitation ne dépend ni de la clôture ni d’un rendez-vous de maintenance.",
      rule: "L’inventaire comporte une fiche par machine (modèle n° 34), actualisée régulièrement et signée par le directeur responsable ou un membre du comité de direction. Les fonctionnaires chargés du contrôle des casinos au service central des courses et jeux ou dans un service territorial compétent peuvent faire ouvrir une machine en exploitation à tout moment.",
      sources: ["reg-controle-inventaire", "reg-controle-ouverture"],
    },
    "Protection des joueurs": {
      gesture: "À l’accueil, expliquez avec discrétion que l’interdiction s’applique dans tous les casinos et clubs de jeux en France. Après trois ans, orientez la personne vers l’Autorité nationale des jeux (ANJ) si elle souhaite demander la levée.",
      pitfall: "Changer de casino ou attendre le troisième anniversaire ne rend pas l’accès possible tant que la mesure reste en vigueur.",
      rule: "L’interdiction volontaire dure au moins trois ans. À l’issue de ce délai, la personne peut demander sa levée à l’ANJ et la mesure se poursuit si elle ne fait aucune démarche.",
      sources: ["reg-protection-duree"],
    },
  },
};
