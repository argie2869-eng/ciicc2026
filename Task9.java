import static java.lang.Math.*;

public class Task9 {

    public static int add(int a, int b) {
        return addExact(a, b);
    }

    public static int subtract(int a, int b) {
        return subtractExact(a, b);
    }

    public static int multiply(int a, int b) {
        return multiplyExact(a, b);
    }

    public static float divide(int a, int b) {
        if (b == 0) {
            throw new ArithmeticException("Cannot divide by zero");
        }
        return floorDiv(a, b);
    }

    public static void main(String[] args) {

        int num1 = 20;
        int num2 = 5;

        System.out.println("First Number: " + num1);
        System.out.println("Second Number: " + num2);

        System.out.println("Addition: " + add(num1, num2));

        System.out.println("Subtraction: " + subtract(num1, num2));

        System.out.println("Multiplication: " + multiply(num1, num2));

        System.out.println("Division: " + divide(num1, num2));
    }
}