CREATE TABLE `white_cards` (
  `card_id` int(11) NOT NULL AUTO_INCREMENT,
  `card_text` text,
  `approved` bit(1) DEFAULT b'1',
  PRIMARY KEY (`card_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4824 DEFAULT CHARSET=latin1;
