// 320 first names + 320 last names — international coverage, no Russian
export const FIRST_NAMES = [
  // === English / American ===
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
  'Thomas', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Christopher', 'Andrew',
  'Joshua', 'Ryan', 'Tyler', 'Nathan', 'Ethan', 'Kevin', 'Justin', 'Brian',
  'Scott', 'Eric', 'Jason', 'Adam', 'Aaron', 'Stephen', 'Patrick',
  'Sarah', 'Emily', 'Jessica', 'Amanda', 'Ashley', 'Lauren', 'Megan', 'Rachel',
  'Nicole', 'Hannah', 'Samantha', 'Rebecca', 'Victoria', 'Stephanie', 'Katherine',
  'Brittany', 'Kayla', 'Amber', 'Heather', 'Alexandra', 'Natalie', 'Allison',
  'Morgan', 'Alexis', 'Chelsea', 'Danielle', 'Melissa', 'Jennifer', 'Lindsay',

  // === German ===
  'Klaus', 'Jürgen', 'Stefan', 'Hans', 'Werner', 'Dieter', 'Gerhard', 'Bernd',
  'Frank', 'Wolfgang', 'Rainer', 'Helmut', 'Uwe', 'Manfred', 'Norbert',
  'Heike', 'Sabine', 'Monika', 'Claudia', 'Inge', 'Gabi', 'Renate', 'Birgit',
  'Karin', 'Hanna', 'Lena', 'Luisa', 'Felix', 'Tobias', 'Markus',

  // === French ===
  'Pierre', 'Jean', 'François', 'Nicolas', 'Philippe', 'Laurent', 'Christophe',
  'Sébastien', 'Julien', 'Quentin', 'Antoine', 'Baptiste', 'Clément', 'Maxime',
  'Marie', 'Claire', 'Isabelle', 'Sophie', 'Amélie', 'Céline', 'Valérie',
  'Nathalie', 'Audrey', 'Camille', 'Élise', 'Chloé', 'Lucie', 'Mathilde',

  // === Italian ===
  'Luca', 'Marco', 'Lorenzo', 'Andrea', 'Alessandro', 'Matteo', 'Davide',
  'Francesco', 'Simone', 'Gianluca', 'Federico', 'Riccardo', 'Stefano',
  'Giulia', 'Elena', 'Sofia', 'Chiara', 'Francesca', 'Valentina', 'Roberta',
  'Alessia', 'Silvia', 'Martina', 'Laura', 'Paola', 'Serena',

  // === Spanish / Latin ===
  'Carlos', 'José', 'Luis', 'Antonio', 'Alejandro', 'Miguel', 'Fernando',
  'Diego', 'Javier', 'Sergio', 'Pablo', 'Adrián', 'Roberto', 'Mario',
  'María', 'Ana', 'Isabel', 'Carmen', 'Valentina', 'Camila', 'Daniela',
  'Gabriela', 'Mariana', 'Sofía', 'Lucía', 'Natalia', 'Paola', 'Andrea',
  'Sebastián', 'Mateo', 'Santiago', 'Nicolás',

  // === Czech / Slovak ===
  'Tomáš', 'Pavel', 'Martin', 'Jiří', 'Petr', 'Jan', 'Michal', 'Lukáš',
  'Ondřej', 'Jakub', 'Marek', 'Radek', 'Vladimír', 'Karel', 'Zdeněk',
  'Lucie', 'Jana', 'Martina', 'Petra', 'Eva', 'Lenka', 'Tereza', 'Veronika',
  'Karolína', 'Markéta', 'Kateřina', 'Barbora', 'Eliška', 'Denisa',

  // === Polish ===
  'Piotr', 'Krzysztof', 'Michał', 'Marcin', 'Bartłomiej', 'Łukasz', 'Marek',
  'Grzegorz', 'Zbigniew', 'Artur', 'Rafał', 'Sławomir', 'Tomasz',
  'Anna', 'Agata', 'Katarzyna', 'Magdalena', 'Joanna', 'Monika', 'Agnieszka',
  'Natalia', 'Aleksandra', 'Dominika', 'Kinga', 'Marta',

  // === Scandinavian ===
  'Sven', 'Lars', 'Erik', 'Bjorn', 'Magnus', 'Johan', 'Gunnar', 'Leif',
  'Torben', 'Henrik', 'Anders', 'Mikael', 'Per', 'Karl', 'Nils',
  'Ingrid', 'Astrid', 'Helga', 'Sigrid', 'Elin', 'Maja', 'Ida', 'Frida',
  'Annika', 'Britta', 'Solveig', 'Hanne', 'Katinka',

  // === Japanese ===
  'Kenji', 'Hiroshi', 'Akira', 'Takashi', 'Haruki', 'Satoshi', 'Ryota',
  'Daisuke', 'Yuichi', 'Kazuya', 'Tatsuya', 'Shingo', 'Yusuke', 'Koichi',
  'Yuki', 'Naomi', 'Aiko', 'Yuko', 'Misaki', 'Rin', 'Saki', 'Nana',
  'Kaori', 'Mika', 'Yui', 'Hana', 'Miho', 'Akemi',

  // === Chinese ===
  'Wei', 'Jing', 'Li', 'Ming', 'Xin', 'Fang', 'Chen', 'Xiao',
  'Hong', 'Bao', 'Feng', 'Jin', 'Hua', 'Tao', 'Lin', 'Yang',
  'Mei', 'Yan', 'Ying', 'Lan', 'Qing', 'Rui', 'Lei', 'Hao',

  // === Korean ===
  'Ji-hoon', 'Min-jun', 'Jae-won', 'Hyun-soo', 'Sung-jin', 'Tae-yang',
  'Dong-hyun', 'Jong-wook', 'Kang-min', 'Won-seok',
  'Soo-Jin', 'Ye-jin', 'Ha-eun', 'Ji-yeon', 'Min-ji', 'Seo-yeon',
  'Bo-ra', 'Na-yeon', 'Hyun-ji', 'Yoo-ri',

  // === Indian ===
  'Arjun', 'Vikram', 'Rahul', 'Aditya', 'Rohan', 'Kiran', 'Suresh',
  'Pavan', 'Anand', 'Vivek', 'Ranjit', 'Sunil', 'Nikhil', 'Deepak',
  'Priya', 'Ananya', 'Kavya', 'Divya', 'Pooja', 'Nisha', 'Sunita',
  'Asha', 'Neha', 'Shilpa', 'Rekha', 'Usha', 'Lakshmi', 'Meena',

  // === Middle Eastern ===
  'Omar', 'Ahmad', 'Khalid', 'Hassan', 'Yusuf', 'Tariq', 'Ibrahim',
  'Nasser', 'Faisal', 'Hamid', 'Reza', 'Mehmet', 'Mustafa', 'Amir', 'Karim',
  'Layla', 'Fatima', 'Nadia', 'Rania', 'Samira', 'Leila', 'Yasmin',
  'Zeinab', 'Maryam', 'Hana', 'Sara', 'Dina', 'Reem', 'Noura',

  // === African ===
  'Kofi', 'Kwame', 'Jabari', 'Amara', 'Chidi', 'Emeka', 'Oluwaseun',
  'Babatunde', 'Adebayo', 'Ekene', 'Ifeoma', 'Chukwuemeka', 'Seun', 'Bode',
  'Abena', 'Nia', 'Zara', 'Aisha', 'Malia', 'Amina', 'Nkechi',
  'Adaeze', 'Chisom', 'Yewande', 'Folake', 'Ngozi', 'Adunola',

  // === Vietnamese / Southeast Asian ===
  'Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Huy', 'Duc', 'Minh',
  'Linh', 'Thanh', 'Nga', 'Phuong', 'Thuy', 'Mai', 'Huong',

  // === Mixed / Universal ===
  'Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Avery', 'Blake', 'Casey',
  'River', 'Phoenix', 'Kai', 'Zara', 'Niko', 'Max', 'Remy', 'Sasha',
  'Milan', 'Nova', 'Atlas', 'Cruz', 'Jax', 'Reign', 'Colt', 'Ace',
]

export const LAST_NAMES = [
  // === English ===
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris',
  'Martin', 'Thompson', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker',
  'Hall', 'Allen', 'Nelson', 'Carter', 'Mitchell', 'Roberts', 'Turner',
  'Campbell', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Perez', 'Hill',
  'Moore', 'Reed', 'Cook', 'Morgan', 'Bell', 'Murphy', 'Bailey', 'Rivera',

  // === German ===
  'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner',
  'Becker', 'Schulz', 'Hoffmann', 'Schäfer', 'Koch', 'Richter', 'Bauer',
  'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann',
  'Braun', 'Krüger', 'Hofmann', 'Hartmann', 'Lange', 'Schmitt',

  // === French ===
  'Dupont', 'Durand', 'Bernard', 'Robert', 'Richard', 'Petit', 'Moreau',
  'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand',
  'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André',
  'Mercier', 'Dupuis', 'Leroy', 'Legrand', 'Gauthier', 'Robin',

  // === Italian ===
  'Rossi', 'Ferrari', 'Russo', 'Romano', 'Colombo', 'Ricci', 'Marino',
  'Bruno', 'Conti', 'De Luca', 'Costa', 'Mancini', 'Fontana', 'Gallo',
  'Lombardi', 'Barbieri', 'Moretti', 'Santoro', 'Marini', 'Ferretti',

  // === Spanish / Portuguese ===
  'García', 'Rodríguez', 'Martínez', 'Hernández', 'López', 'González',
  'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez',
  'Díaz', 'Cruz', 'Reyes', 'Morales', 'Ortiz', 'Jiménez', 'Castro',
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Ferreira', 'Pereira',
  'Almeida', 'Barbosa', 'Carvalho', 'Martins', 'Rocha', 'Correia',

  // === Czech / Slovak ===
  'Novák', 'Svoboda', 'Dvořák', 'Černý', 'Procházka', 'Kučera', 'Veselý',
  'Blaha', 'Kratochvíl', 'Horák', 'Janda', 'Fiala', 'Pospíšil', 'Navrátil',
  'Šimánek', 'Kratochvílová', 'Sedláček', 'Fišer', 'Macháček', 'Kovář',

  // === Polish ===
  'Kowalski', 'Wiśniewski', 'Wójcik', 'Kowalczyk', 'Kamiński', 'Lewandowski',
  'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski', 'Kozłowski', 'Jankowski',
  'Mazur', 'Krawczyk', 'Piotrowska', 'Grabowski', 'Nowakowski', 'Michalski',

  // === Scandinavian ===
  'Johansson', 'Lindqvist', 'Karlsson', 'Andersen', 'Nielsen', 'Jensen',
  'Hansson', 'Eriksson', 'Svensson', 'Gustafsson', 'Petersen', 'Hansen',
  'Larsen', 'Holm', 'Christensen', 'Pedersen', 'Olsen', 'Dahl',

  // === Japanese ===
  'Tanaka', 'Watanabe', 'Sato', 'Suzuki', 'Ito', 'Nakamura', 'Kobayashi',
  'Yamamoto', 'Kato', 'Hayashi', 'Shimizu', 'Yamaguchi', 'Matsumoto',
  'Inoue', 'Kimura', 'Ogawa', 'Fujita', 'Nishimura', 'Okamoto', 'Mori',

  // === Chinese ===
  'Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao',
  'Wu', 'Zhou', 'Sun', 'Ma', 'Zhu', 'Hu', 'Guo', 'He',
  'Gao', 'Lin', 'Luo', 'Zheng', 'Liang', 'Xie', 'Tang', 'Han',

  // === Korean ===
  'Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Yoon', 'Jang',
  'Lim', 'Oh', 'Han', 'Seo', 'Kwon', 'Shin', 'Cho', 'Song',

  // === Indian ===
  'Patel', 'Sharma', 'Singh', 'Kumar', 'Gupta', 'Mishra', 'Verma',
  'Yadav', 'Mehta', 'Chopra', 'Nair', 'Iyer', 'Reddy', 'Joshi',
  'Kapoor', 'Shah', 'Malhotra', 'Bose', 'Das', 'Rao', 'Pillai', 'Menon',

  // === Middle Eastern / Turkish ===
  'Al-Rashid', 'Hassan', 'Ibrahim', 'Al-Farsi', 'Khalil', 'Nassar', 'Qureshi',
  'Chaudhry', 'Abbasi', 'Bukhari', 'Yilmaz', 'Öztürk', 'Demir', 'Şahin',
  'Kaya', 'Çelik', 'Arslan', 'Doğan', 'Aydın', 'Erdoğan', 'Güneş',
  'Al-Ahmad', 'Al-Hassan', 'Al-Mansouri', 'Al-Zaidi', 'Karimi',

  // === African ===
  'Okafor', 'Mensah', 'Diallo', 'Traoré', 'Keita', 'Ndiaye', 'Touré',
  'Kamara', 'Koné', 'Bah', 'Diop', 'Coulibaly', 'Sissoko', 'Cissé',
  'Abubakar', 'Musa', 'Adeyemi', 'Obi', 'Eze', 'Chukwu', 'Onyeka',
  'Mwangi', 'Otieno', 'Achieng', 'Waweru', 'Kariuki', 'Ndungu', 'Gitau',

  // === Vietnamese / Southeast Asian ===
  'Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Phan', 'Vu', 'Dang',
  'Bui', 'Do', 'Ho', 'Ngo', 'Duong', 'Ly',
  'Wiranto', 'Santoso', 'Suharto', 'Sutrisno', 'Pranoto',

  // === Mixed / Cover names / Aliases ===
  'Cross', 'Fox', 'Stone', 'Grant', 'Drake', 'Chase', 'Black', 'Wolf',
  'Sharp', 'Gray', 'Cole', 'Knox', 'Steele', 'Quinn', 'Pierce', 'Frost',
  'Flynn', 'Rowe', 'Banks', 'Hyde', 'Kane', 'Nash', 'Voss', 'Crane',
  'Holt', 'Marsh', 'Lane', 'Vane', 'Cane', 'Hawk', 'Wren', 'Vale',
  'Saxon', 'Thorn', 'Vance', 'Stark', 'Blane', 'Croft', 'Dare', 'Edge',
  'Gage', 'Hale', 'Ink', 'Jade', 'Kade', 'Lark', 'Mace', 'Night',
]
