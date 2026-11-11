import java.util.Scanner;

public class Task7 {

    // Addition method
    public static double add(double num1, double num2) {
        return num1 + num2;
    }

    // Subtraction method
    public static double subtract(double num1, double num2) {
        return num1 - num2;
    }

    // Multiplication method
    public static double multiply(double num1, double num2) {
        return num1 * num2;
    }

    // Division method
    public static double divide(double num1, double num2) {
        return num1 / num2;
    }

    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);

        System.out.print("Enter first number: ");
        double num1 = input.nextDouble();

        System.out.print("Enter second number: ");
        double num2 = input.nextDouble();

        System.out.println("\nResults:");
        System.out.println("Addition: " + add(num1, num2));
        System.out.println("Subtraction: " + subtract(num1, num2));
        System.out.println("Multiplication: " + multiply(num1, num2));

        if (num2 != 0) {
            System.out.println("Division: " + divide(num1, num2));
        } else {
            System.out.println("Division: Cannot divide by zero.");
        }

        input.close();
    }
}