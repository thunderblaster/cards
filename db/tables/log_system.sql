CREATE TABLE `log_system` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `level` varchar(16) NOT NULL,
  `message` varchar(512) NOT NULL,
  `meta` varchar(1024) NOT NULL,
  `timestamp` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=latin1;
