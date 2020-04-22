CREATE TABLE `log_card` (
  `log_card_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `room` varchar(255) DEFAULT NULL,
  `black_card` int(11) DEFAULT NULL,
  `winning_white_card` int(11) DEFAULT NULL,
  `losing_white_cards` json DEFAULT NULL,
  `time` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_card_id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=latin1;
