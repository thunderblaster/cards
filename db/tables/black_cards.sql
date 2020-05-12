CREATE TABLE `black_cards` (
  `card_id` int(11) NOT NULL AUTO_INCREMENT,
  `card_text` text,
  `number_of_responses` int(11) DEFAULT '1',
  `approved` bit(1) DEFAULT b'1',
  PRIMARY KEY (`card_id`)
) ENGINE=InnoDB AUTO_INCREMENT=476 DEFAULT CHARSET=latin1;
