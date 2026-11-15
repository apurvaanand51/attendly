package edu.university.attendance;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;

@SpringBootApplication
public class AttendanceApplication {
    public static void main(String[] args) {
        SpringApplication.run(AttendanceApplication.class, args);
    }

    @Bean
    CommandLineRunner demoData(JdbcTemplate jdbc) {
        return args -> {
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM students", Integer.class);
            if (count != null && count == 0) {
                jdbc.update("INSERT INTO students (roll_number, name, department, email) VALUES (?, ?, ?, ?)",
                        "CU-2401", "Aarav Sharma", "Computer Science", "aarav@university.edu");
                jdbc.update("INSERT INTO students (roll_number, name, department, email) VALUES (?, ?, ?, ?)",
                        "CU-2402", "Ananya Mehta", "Computer Science", "ananya@university.edu");
                jdbc.update("INSERT INTO students (roll_number, name, department, email) VALUES (?, ?, ?, ?)",
                        "CU-2403", "Kabir Singh", "Information Technology", "kabir@university.edu");
                jdbc.update("INSERT INTO students (roll_number, name, department, email) VALUES (?, ?, ?, ?)",
                        "CU-2404", "Meera Kapoor", "Electronics", "meera@university.edu");
                jdbc.update("INSERT INTO students (roll_number, name, department, email) VALUES (?, ?, ?, ?)",
                        "CU-2405", "Ishaan Verma", "Computer Science", "ishaan@university.edu");

                int[] attendanceRates = {5, 4, 3, 5, 2};
                LocalDate today = LocalDate.now();
                for (int student = 0; student < attendanceRates.length; student++) {
                    for (int day = 0; day < 5; day++) {
                        jdbc.update("""
                                INSERT INTO attendance (student_id, subject, attendance_date, status)
                                VALUES (?, ?, ?, ?)
                                """, student + 1, "Object Oriented Programming",
                                today.minusDays(4L - day), day < attendanceRates[student] ? "PRESENT" : "ABSENT");
                    }
                }
            }
        };
    }
}
